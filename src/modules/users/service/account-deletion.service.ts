import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../config/database.js';
import { ConflictError, NotFoundError } from '../../../common/errors/app-error.js';
import { lockUserLifecycle } from '../../../common/utils/account-lifecycle.util.js';
import { UploadsService } from '../../uploads/service/uploads.service.js';

const LEASE_MS = 2 * 60 * 1000;
const PRESIGNED_URL_SAFETY_MS = 65 * 60 * 1000;
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type ObjectTarget = { bucket: string; key: string; fileUrl: string; availableAt: Date };
type FailedTarget = { fileUrl: string; error: string };

export interface CleanupBatchResult {
  claimed: number;
  succeeded: number;
  failed: number;
  deadLettered: number;
}

export class AccountDeletionService {
  constructor(private readonly uploadsService: UploadsService = new UploadsService()) {}

  /**
   * Fences new writes immediately, snapshots every referenced/granted cloud
   * object, creates durable cleanup jobs, and only then returns. User metadata
   * remains present until the worker verifies cleanup completion.
   */
  async requestDeletion(userId: string): Promise<
    | { status: 'DELETING'; jobId: string }
    | { status: 'COMPLETED'; jobId?: string; completedAt: Date }
  > {
    const completedResult = async () => {
      const receipt = await prisma.accountDeletionReceipt.findUnique({ where: { userId } });
      if (!receipt) return null;
      const job = await prisma.accountDeletionJob.findUnique({ where: { userId }, select: { id: true } });
      return {
        status: 'COMPLETED' as const,
        ...(job ? { jobId: job.id } : {}),
        completedAt: receipt.completedAt,
      };
    };

    const priorCompletion = await completedResult();
    if (priorCompletion) return priorCompletion;

    try {
      return await prisma.$transaction(async (tx) => {
      const lifecycle = await lockUserLifecycle(tx, userId);
      const existingJob = await tx.accountDeletionJob.findUnique({ where: { userId } });
      if (lifecycle === 'DELETING' && existingJob) {
        return { status: 'DELETING' as const, jobId: existingJob.id };
      }

      const [documents, grants] = await Promise.all([
        tx.document.findMany({
          where: { userId },
          include: { pages: true },
        }),
        tx.uploadGrant.findMany({ where: { userId } }),
      ]);

      await tx.user.update({
        where: { id: userId },
        data: { lifecycleStatus: 'DELETING' },
      });

      const job = existingJob
        ? await tx.accountDeletionJob.update({
            where: { id: existingJob.id },
            data: { status: 'PENDING', attempts: 0, lastError: null, claimToken: null, leaseExpiresAt: null },
          })
        : await tx.accountDeletionJob.create({
            data: { userId, status: 'PENDING' },
          });

      if (documents.length > 0) {
        await tx.documentTombstone.createMany({
          data: documents.map((document) => ({ userId, documentId: document.id })),
          skipDuplicates: true,
        });
      }

      const targets = new Map<string, ObjectTarget>();
      const failed = new Map<string, FailedTarget>();
      const now = new Date();
      const legacySafetyDeadline = new Date(now.getTime() + PRESIGNED_URL_SAFETY_MS);

      const addTarget = (fileUrl: string, bucket: string, key: string, safeAt: Date) => {
        const id = `${bucket}\u0000${key}`;
        const existing = targets.get(id);
        if (!existing || safeAt > existing.availableAt) {
          targets.set(id, { bucket, key, fileUrl, availableAt: safeAt });
        }
      };

      // The durable grant ledger is authoritative for issued object keys.
      for (const grant of grants) {
        if (grant.cleanupDone) continue;
        if (!grant.bucket || !grant.objectKey) {
          failed.set(`grant:${grant.id}`, {
            fileUrl: grant.fileUrl,
            error: 'Legacy upload grant has no exact bucket/key; operator inventory required',
          });
          continue;
        }
        try {
          const resolved = this.uploadsService.resolveOwnedObjectUrl(grant.fileUrl, userId);
          if (resolved.bucket !== grant.bucket || resolved.key !== grant.objectKey) {
            throw new Error('Grant URL does not match its recorded bucket/key');
          }
          const grantSafeAt = new Date(grant.expiresAt.getTime() + EXPIRY_MARGIN_MS);
          addTarget(grant.fileUrl, grant.bucket, grant.objectKey,
            grantSafeAt > now ? grantSafeAt : now);
        } catch (error) {
          failed.set(`grant:${grant.id}`, {
            fileUrl: grant.fileUrl,
            error: error instanceof Error ? error.message : 'Grant target validation failed',
          });
        }
      }

      for (const document of documents) {
        const urls = [
          document.thumbnailUrl,
          document.pdfUrl,
          ...document.pages.flatMap((page) => [page.imageUrl, page.thumbnailUrl]),
        ].filter((value): value is string => typeof value === 'string' && /^https?:\/\//i.test(value));
        for (const fileUrl of urls) {
          try {
            const target = this.uploadsService.resolveOwnedObjectUrl(fileUrl, userId);
            const matchedGrants = grants.filter(
              (grant) => grant.bucket === target.bucket && grant.objectKey === target.key,
            );
            const expirySafeAt = matchedGrants.length === 0
              ? legacySafetyDeadline
              : matchedGrants.reduce((latest, grant) => {
                  const safeAt = new Date(grant.expiresAt.getTime() + EXPIRY_MARGIN_MS);
                  return safeAt > latest ? safeAt : latest;
                }, now);
            addTarget(fileUrl, target.bucket, target.key, expirySafeAt);
          } catch (error) {
            failed.set(`url:${fileUrl}`, {
              fileUrl,
              error: error instanceof Error ? error.message : 'Object URL validation failed',
            });
          }
        }
      }

      // Existing document-delete jobs are already durable; the worker will
      // process them too. New targets are deduplicated by exact bucket/key.
      for (const target of targets.values()) {
        const duplicate = await tx.pendingDeletion.findFirst({
          where: {
            userId,
            bucket: target.bucket,
            objectKey: target.key,
            status: { not: 'COMPLETED' },
          },
          select: { id: true },
        });
        if (!duplicate) {
          await tx.pendingDeletion.create({
            data: {
              userId,
              fileUrl: target.fileUrl,
              bucket: target.bucket,
              objectKey: target.key,
              status: 'PENDING',
              availableAt: target.availableAt,
            },
          });
        }
      }

      for (const item of failed.values()) {
        const duplicate = await tx.pendingDeletion.findFirst({
          where: { userId, fileUrl: item.fileUrl, status: { not: 'COMPLETED' } },
          select: { id: true },
        });
        if (!duplicate) {
          await tx.pendingDeletion.create({
            data: {
              userId,
              fileUrl: item.fileUrl,
              bucket: null,
              objectKey: null,
              status: 'FAILED',
              lastError: `Requires operator inventory: ${item.error}`,
            },
          });
        }
      }

      console.info('[AccountDeletion] Durable account deletion requested', {
        userId,
        jobId: job.id,
        cleanupTargets: targets.size,
        operatorReviewTargets: failed.size,
      });
      return { status: 'DELETING' as const, jobId: job.id };
      });
    } catch (error) {
      // A repeated DELETE may race the finalizer: if the user row disappears
      // after our receipt preflight, convert that race into an idempotent success.
      if (error instanceof NotFoundError) {
        const completed = await completedResult();
        if (completed) return completed;
      }
      throw error;
    }
  }

  /** Claim and process due deletion jobs with MySQL row locks and per-claim fencing. */
  async processPendingDeletionBatch(limit = 10): Promise<CleanupBatchResult> {
    const claims = await this.claimPendingDeletions(limit);
    let succeeded = 0;
    let failed = 0;
    let deadLettered = 0;

    for (const claim of claims) {
      try {
        if (!claim.bucket || !claim.objectKey) {
          throw new Error('Cleanup job has no exact bucket/key; operator inventory required');
        }
        await this.uploadsService.deleteObject(claim.bucket, claim.objectKey, claim.userId);
        const acknowledged = await prisma.$transaction(async (tx) => {
          const result = await tx.pendingDeletion.updateMany({
            where: { id: claim.id, status: 'PROCESSING', claimToken: claim.claimToken },
            data: { status: 'COMPLETED', claimToken: null, leaseExpiresAt: null, lastError: null },
          });
          if (result.count !== 1) return false; // stale worker lost the lease
          await tx.uploadGrant.updateMany({
            where: { userId: claim.userId, bucket: claim.bucket!, objectKey: claim.objectKey! },
            data: { cleanupDone: true },
          });
          return true;
        });
        if (acknowledged) succeeded++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const outcome = await this.failPendingDeletionClaim(claim, message);
        if (outcome === 'FAILED') failed++;
        if (outcome === 'DEAD_LETTER') deadLettered++;
      }
    }

    return { claimed: claims.length, succeeded, failed, deadLettered };
  }

  private async claimPendingDeletions(limit: number): Promise<Array<{
    id: string; userId: string; bucket: string | null; objectKey: string | null; attempts: number; claimToken: string;
  }>> {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{
        id: string; user_id: string; bucket: string | null; object_key: string | null;
        status: string; attempts: number;
      }>>`
        SELECT id, user_id, bucket, object_key, status, attempts
        FROM pending_deletions
        WHERE (status = 'PENDING' AND available_at <= NOW(3))
           OR (status = 'PROCESSING' AND lease_expires_at <= NOW(3))
        ORDER BY available_at ASC, created_at ASC
        LIMIT ${Math.max(1, Math.min(limit, 100))}
        FOR UPDATE SKIP LOCKED
      `;
      const claims: Array<{
        id: string; userId: string; bucket: string | null; objectKey: string | null; attempts: number; claimToken: string;
      }> = [];
      for (const row of rows) {
        const recoveringExpiredLease = row.status === 'PROCESSING';
        const attempts = row.attempts + (recoveringExpiredLease ? 1 : 0);
        if (attempts >= MAX_ATTEMPTS) {
          await tx.pendingDeletion.updateMany({
            where: { id: row.id, status: row.status as 'PENDING' | 'PROCESSING' },
            data: {
              status: 'DEAD_LETTER',
              attempts,
              claimToken: null,
              leaseExpiresAt: null,
              lastError: 'Maximum attempts reached; manual operator requeue required',
            },
          });
          continue;
        }
        const claimToken = crypto.randomUUID();
        const result = await tx.pendingDeletion.updateMany({
          where: { id: row.id, status: row.status as 'PENDING' | 'PROCESSING' },
          data: {
            status: 'PROCESSING',
            attempts,
            claimToken,
            leaseExpiresAt: new Date(Date.now() + LEASE_MS),
          },
        });
        if (result.count === 1) {
          claims.push({
            id: row.id, userId: row.user_id, bucket: row.bucket,
            objectKey: row.object_key, attempts, claimToken,
          });
        }
      }
      return claims;
    });
  }

  private async failPendingDeletionClaim(
    claim: { id: string; claimToken: string; attempts: number },
    message: string,
  ): Promise<'STALE' | 'FAILED' | 'DEAD_LETTER'> {
    return prisma.$transaction(async (tx) => {
      const nextAttempts = claim.attempts + 1;
      const terminal = nextAttempts >= MAX_ATTEMPTS;
      const result = await tx.pendingDeletion.updateMany({
        where: { id: claim.id, status: 'PROCESSING', claimToken: claim.claimToken },
        data: {
          status: terminal ? 'DEAD_LETTER' : 'PENDING',
          attempts: nextAttempts,
          availableAt: new Date(Date.now() + Math.min(30 * 60_000, 15_000 * (2 ** Math.min(nextAttempts, 6)))),
          claimToken: null,
          leaseExpiresAt: null,
          lastError: message.slice(0, 4000),
        },
      });
      if (result.count !== 1) return 'STALE';
      console.error('[StorageCleanup] Object deletion failed', {
        jobId: claim.id, attempts: nextAttempts, terminal, error: message,
      });
      return terminal ? 'DEAD_LETTER' : 'FAILED';
    });
  }

  async processAccountDeletionBatch(limit = 5): Promise<{ claimed: number; finalized: number; waiting: number; failed: number }> {
    const claims = await this.claimAccountDeletionJobs(limit);
    let finalized = 0;
    let waiting = 0;
    let failed = 0;

    for (const claim of claims) {
      try {
        const result = await this.finalizeOrRescheduleAccountDeletion(claim);
        if (result === 'COMPLETED') finalized++;
        else if (result === 'WAITING') waiting++;
        else failed++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.failAccountDeletionClaim(claim, message);
        failed++;
      }
    }
    return { claimed: claims.length, finalized, waiting, failed };
  }

  private async claimAccountDeletionJobs(limit: number): Promise<Array<{
    id: string; userId: string; attempts: number; claimToken: string;
  }>> {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{
        id: string; user_id: string; status: string; attempts: number;
      }>>`
        SELECT id, user_id, status, attempts
        FROM account_deletion_jobs
        WHERE (status = 'PENDING' AND updated_at <= DATE_SUB(NOW(3), INTERVAL 15 SECOND))
           OR (status = 'PROCESSING' AND lease_expires_at <= NOW(3))
        ORDER BY updated_at ASC
        LIMIT ${Math.max(1, Math.min(limit, 50))}
        FOR UPDATE SKIP LOCKED
      `;
      const claims: Array<{ id: string; userId: string; attempts: number; claimToken: string }> = [];
      for (const row of rows) {
        const attempts = row.attempts + (row.status === 'PROCESSING' ? 1 : 0);
        if (attempts >= MAX_ATTEMPTS) {
          await tx.accountDeletionJob.updateMany({
            where: { id: row.id, status: row.status as 'PENDING' | 'PROCESSING' },
            data: {
              status: 'DEAD_LETTER', attempts, claimToken: null, leaseExpiresAt: null,
              lastError: 'Account finalization retry limit reached; operator review required',
            },
          });
          continue;
        }
        const claimToken = crypto.randomUUID();
        const result = await tx.accountDeletionJob.updateMany({
          where: { id: row.id, status: row.status as 'PENDING' | 'PROCESSING' },
          data: { status: 'PROCESSING', attempts, claimToken, leaseExpiresAt: new Date(Date.now() + LEASE_MS) },
        });
        if (result.count === 1) claims.push({ id: row.id, userId: row.user_id, attempts, claimToken });
      }
      return claims;
    });
  }

  private async finalizeOrRescheduleAccountDeletion(
    claim: { id: string; userId: string; claimToken: string },
  ): Promise<'COMPLETED' | 'WAITING' | 'FAILED'> {
    return prisma.$transaction(async (tx) => {
      const ownedJob = await tx.accountDeletionJob.findFirst({
        where: { id: claim.id, userId: claim.userId, status: 'PROCESSING', claimToken: claim.claimToken },
      });
      if (!ownedJob) return 'FAILED';

      // Lock the user row before evaluating/finalizing. All mutations use this
      // same lock; a late operation cannot sneak in after the cleanup snapshot.
      const lifecycle = await lockUserLifecycle(tx, claim.userId);
      if (lifecycle !== 'DELETING') {
        throw new ConflictError('Account is not in deleting state', 'ACCOUNT_NOT_DELETING');
      }

      const [unfinishedJobs, unfinishedGrants, deadLetterJobs] = await Promise.all([
        tx.pendingDeletion.count({ where: { userId: claim.userId, status: { not: 'COMPLETED' } } }),
        tx.uploadGrant.count({ where: { userId: claim.userId, cleanupDone: false } }),
        tx.pendingDeletion.count({ where: { userId: claim.userId, status: 'DEAD_LETTER' } }),
      ]);

      if (unfinishedJobs > 0 || unfinishedGrants > 0) {
        const failedJobs = await tx.pendingDeletion.count({
          where: { userId: claim.userId, status: 'FAILED' },
        });
        // FAILED rows are deliberately not auto-claimed. Surface every one to
        // an operator, even when a key has been inventoried and is requeueable.
        const requiresOperator = deadLetterJobs > 0 || failedJobs > 0;
        await tx.accountDeletionJob.updateMany({
          where: { id: claim.id, status: 'PROCESSING', claimToken: claim.claimToken },
          data: {
            status: requiresOperator ? 'FAILED' : 'PENDING',
            claimToken: null,
            leaseExpiresAt: null,
            lastError: requiresOperator
              ? 'Object cleanup requires operator inventory or manual dead-letter requeue'
              : `Waiting for cleanup: ${unfinishedJobs} unfinished jobs, ${unfinishedGrants} unfinished grants`,
          },
        });
        return requiresOperator ? 'FAILED' : 'WAITING';
      }

      const completedJobs = await tx.pendingDeletion.count({
        where: { userId: claim.userId, status: 'COMPLETED' },
      });
      await tx.accountDeletionReceipt.upsert({
        where: { userId: claim.userId },
        create: { userId: claim.userId, completedAt: new Date(), objectsQueued: completedJobs },
        update: { completedAt: new Date(), objectsQueued: completedJobs },
      });

      // Receipt, user cascade delete, and durable job completion commit together.
      await tx.user.delete({ where: { id: claim.userId } });
      const acknowledged = await tx.accountDeletionJob.updateMany({
        where: { id: claim.id, userId: claim.userId, status: 'PROCESSING', claimToken: claim.claimToken },
        data: { status: 'COMPLETED', claimToken: null, leaseExpiresAt: null, lastError: null },
      });
      if (acknowledged.count !== 1) {
        throw new ConflictError('Account deletion lease was lost during finalization', 'DELETION_LEASE_LOST');
      }
      console.info('[AccountDeletion] Account deletion completed', { userId: claim.userId, jobId: claim.id });
      return 'COMPLETED';
    });
  }

  private async failAccountDeletionClaim(
    claim: { id: string; claimToken: string; attempts: number },
    message: string,
  ): Promise<void> {
    const nextAttempts = claim.attempts + 1;
    const terminal = nextAttempts >= MAX_ATTEMPTS;
    await prisma.accountDeletionJob.updateMany({
      where: { id: claim.id, status: 'PROCESSING', claimToken: claim.claimToken },
      data: {
        status: terminal ? 'DEAD_LETTER' : 'PENDING',
        attempts: nextAttempts,
        claimToken: null,
        leaseExpiresAt: null,
        lastError: message.slice(0, 4000),
      },
    });
    console.error('[AccountDeletion] Worker failed', {
      jobId: claim.id, attempts: nextAttempts, terminal, error: message,
    });
  }

  /** Controlled operator recovery for an account job that reached FAILED/DEAD_LETTER. */
  async requeueAccountDeletionJob(jobId: string): Promise<void> {
    const job = await prisma.accountDeletionJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundError('Account deletion job not found', 'ACCOUNT_DELETION_JOB_NOT_FOUND');
    if (job.status !== 'FAILED' && job.status !== 'DEAD_LETTER') {
      throw new ConflictError('Only failed or dead-letter account jobs can be requeued', 'ACCOUNT_DELETION_JOB_NOT_REQUEUEABLE');
    }
    await prisma.accountDeletionJob.updateMany({
      where: { id: jobId, status: job.status, userId: job.userId },
      data: {
        status: 'PENDING',
        attempts: 0,
        claimToken: null,
        leaseExpiresAt: null,
        lastError: null,
      },
    });
  }

  /** Controlled operator recovery: only failed/dead-letter exact-key jobs are requeued. */
  async requeueCleanupJob(jobId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const job = await tx.pendingDeletion.findUnique({ where: { id: jobId } });
      if (!job) throw new NotFoundError('Cleanup job not found', 'CLEANUP_JOB_NOT_FOUND');
      if (!job.bucket || !job.objectKey) {
        throw new ConflictError('Cleanup target lacks an exact bucket/key; inventory it before requeueing', 'CLEANUP_TARGET_UNRESOLVED');
      }
      if (job.status !== 'FAILED' && job.status !== 'DEAD_LETTER') {
        throw new ConflictError('Only failed or dead-letter jobs can be requeued', 'CLEANUP_JOB_NOT_REQUEUEABLE');
      }
      await tx.pendingDeletion.update({
        where: { id: jobId },
        data: { status: 'PENDING', attempts: 0, availableAt: new Date(), claimToken: null, leaseExpiresAt: null, lastError: null },
      });
      await tx.accountDeletionJob.updateMany({
        where: { userId: job.userId, status: { in: ['FAILED', 'DEAD_LETTER'] } },
        data: { status: 'PENDING', attempts: 0, claimToken: null, leaseExpiresAt: null, lastError: null },
      });
    });
  }
}
