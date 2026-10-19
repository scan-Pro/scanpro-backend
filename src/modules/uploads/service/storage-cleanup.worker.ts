import { randomUUID } from 'node:crypto';
import { prisma } from '../../../config/database.js';
import { UploadsService } from './uploads.service.js';

const MAX_FILE_ATTEMPTS = 5;
const FILE_LEASE_MS = 2 * 60 * 1000;
const ACCOUNT_LEASE_MS = 2 * 60 * 1000;

export interface StorageCleanupRunResult {
  fileJobsClaimed: number;
  fileJobsCompleted: number;
  fileJobsFailed: number;
  accountJobsClaimed: number;
  accountsFinalized: number;
  accountsBlocked: number;
}

/**
 * Durable, database-coordinated cleanup worker. Each claim uses compare-and-set
 * conditions and a random lease token so two server processes cannot both
 * acknowledge the same claim. Object DELETE is idempotent at S3/B2.
 */
export class StorageCleanupWorker {
  constructor(private readonly uploadsService: UploadsService = new UploadsService()) {}

  async runOnce(): Promise<StorageCleanupRunResult> {
    const result: StorageCleanupRunResult = {
      fileJobsClaimed: 0,
      fileJobsCompleted: 0,
      fileJobsFailed: 0,
      accountJobsClaimed: 0,
      accountsFinalized: 0,
      accountsBlocked: 0,
    };
    await this.processFileJobs(25, result);
    await this.processAccountJobs(10, result);
    return result;
  }

  private async processFileJobs(
    limit: number,
    result: StorageCleanupRunResult
  ): Promise<void> {
    const now = new Date();
    const candidates = await prisma.pendingDeletion.findMany({
      where: {
        attempts: { lt: MAX_FILE_ATTEMPTS },
        OR: [
          { status: { in: ['PENDING', 'FAILED'] }, OR: [{ notBefore: null }, { notBefore: { lte: now } }] },
          { status: 'RETRYING', leaseExpiresAt: { lte: now }, OR: [{ notBefore: null }, { notBefore: { lte: now } }] },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    for (const candidate of candidates) {
      const token = randomUUID();
      const claimNow = new Date();
      const eligibleNotBefore = [{ notBefore: null }, { notBefore: { lte: claimNow } }] as const;
      const claimed = await prisma.pendingDeletion.updateMany({
        where: {
          id: candidate.id,
          attempts: { lt: MAX_FILE_ATTEMPTS },
          OR: [
            {
              status: { in: ['PENDING', 'FAILED'] },
              AND: [{ OR: [...eligibleNotBefore] }],
            },
            {
              status: 'RETRYING',
              leaseExpiresAt: { lte: claimNow },
              AND: [{ OR: [...eligibleNotBefore] }],
            },
          ],
        },
        data: {
          status: 'RETRYING',
          attempts: { increment: 1 },
          leaseToken: token,
          leaseExpiresAt: new Date(claimNow.getTime() + FILE_LEASE_MS),
        },
      });
      if (claimed.count !== 1) continue;
      result.fileJobsClaimed++;

      if (!candidate.bucket || !candidate.objectKey || !candidate.objectIdentity) {
        await prisma.pendingDeletion.updateMany({
          where: { id: candidate.id, status: 'RETRYING', leaseToken: token },
          data: {
            status: 'DEAD_LETTER',
            lastError: 'Missing validated bucket/key/object identity; manual legacy-object inventory required.',
            leaseToken: null,
            leaseExpiresAt: null,
          },
        });
        result.fileJobsFailed++;
        continue;
      }

      try {
        await this.uploadsService.deleteFileByKey(candidate.bucket, candidate.objectKey);
        const acknowledged = await prisma.pendingDeletion.updateMany({
          where: { id: candidate.id, status: 'RETRYING', leaseToken: token },
          data: { status: 'COMPLETED', lastError: null, leaseToken: null, leaseExpiresAt: null },
        });
        if (acknowledged.count === 1) {
          await prisma.uploadGrant.updateMany({
            where: {
              userId: candidate.userId,
              bucket: candidate.bucket,
              objectKey: candidate.objectKey,
              objectIdentity: candidate.objectIdentity,
            },
            data: { cleanupDone: true, cleanupState: 'COMPLETED' },
          });
          result.fileJobsCompleted++;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const nextStatus = candidate.attempts + 1 >= MAX_FILE_ATTEMPTS ? 'DEAD_LETTER' : 'FAILED';
        await prisma.pendingDeletion.updateMany({
          where: { id: candidate.id, status: 'RETRYING', leaseToken: token },
          data: {
            status: nextStatus,
            lastError: message.slice(0, 4000),
            leaseToken: null,
            leaseExpiresAt: null,
          },
        });
        if (candidate.objectIdentity) {
          await prisma.uploadGrant.updateMany({
            where: {
              userId: candidate.userId,
              bucket: candidate.bucket,
              objectKey: candidate.objectKey,
              objectIdentity: candidate.objectIdentity,
              cleanupDone: false,
            },
            data: { cleanupState: 'FAILED' },
          });
        }
        result.fileJobsFailed++;
      }
    }
  }

  private async processAccountJobs(
    limit: number,
    result: StorageCleanupRunResult
  ): Promise<void> {
    const now = new Date();
    const candidates = await prisma.accountDeletionJob.findMany({
      where: {
        OR: [
          { status: 'PENDING' },
          { status: 'CLEANING', leaseExpiresAt: { lte: now } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    for (const candidate of candidates) {
      const token = randomUUID();
      const claimNow = new Date();
      const claimed = await prisma.accountDeletionJob.updateMany({
        where: {
          id: candidate.id,
          OR: [
            { status: 'PENDING' },
            { status: 'CLEANING', leaseExpiresAt: { lte: claimNow } },
          ],
        },
        data: {
          status: 'CLEANING',
          leaseToken: token,
          leaseExpiresAt: new Date(claimNow.getTime() + ACCOUNT_LEASE_MS),
          startedAt: candidate.startedAt ?? claimNow,
          lastError: null,
        },
      });
      if (claimed.count !== 1) continue;
      result.accountJobsClaimed++;

      try {
        const deadLetters = await prisma.pendingDeletion.count({
          where: { userId: candidate.userId, status: 'DEAD_LETTER' },
        });
        if (deadLetters > 0) {
          await prisma.accountDeletionJob.updateMany({
            where: { id: candidate.id, status: 'CLEANING', leaseToken: token },
            data: {
              status: 'FAILED',
              lastError: `${deadLetters} cleanup item(s) require operator review before account finalization.`,
              leaseToken: null,
              leaseExpiresAt: null,
            },
          });
          result.accountsBlocked++;
          continue;
        }

        const [unfinishedFiles, unfinishedGrants] = await Promise.all([
          prisma.pendingDeletion.count({
            where: { userId: candidate.userId, status: { not: 'COMPLETED' } },
          }),
          prisma.uploadGrant.count({
            where: { userId: candidate.userId, cleanupDone: false },
          }),
        ]);
        if (unfinishedFiles > 0 || unfinishedGrants > 0) {
          await prisma.accountDeletionJob.updateMany({
            where: { id: candidate.id, status: 'CLEANING', leaseToken: token },
            data: { status: 'PENDING', leaseToken: null, leaseExpiresAt: null },
          });
          continue;
        }

        const finalized = await prisma.$transaction(async (tx) => {
          const userRows = await tx.$queryRaw<Array<{ id: string; lifecycle_status: string }>>`
            SELECT id, lifecycle_status FROM users WHERE id = ${candidate.userId} FOR UPDATE
          `;
          const job = await tx.accountDeletionJob.findFirst({
            where: { id: candidate.id, status: 'CLEANING', leaseToken: token },
          });
          if (!job) return false;

          const [pendingCount, grantCount] = await Promise.all([
            tx.pendingDeletion.count({
              where: { userId: candidate.userId, status: { not: 'COMPLETED' } },
            }),
            tx.uploadGrant.count({ where: { userId: candidate.userId, cleanupDone: false } }),
          ]);
          if (pendingCount > 0 || grantCount > 0) {
            await tx.accountDeletionJob.updateMany({
              where: { id: candidate.id, status: 'CLEANING', leaseToken: token },
              data: { status: 'PENDING', leaseToken: null, leaseExpiresAt: null },
            });
            return false;
          }

          if (userRows.length > 0) {
            if (userRows[0].lifecycle_status !== 'DELETING') {
              throw new Error('Account lifecycle is not DELETING; refusing finalization');
            }
            // Job has no FK to users: receipt survives the cascade.
            await tx.accountDeletionJob.updateMany({
              where: { id: candidate.id, status: 'CLEANING', leaseToken: token },
              data: {
                status: 'COMPLETED',
                completedAt: new Date(),
                leaseToken: null,
                leaseExpiresAt: null,
                lastError: null,
              },
            });
            await tx.user.delete({ where: { id: candidate.userId } });
          } else {
            await tx.accountDeletionJob.updateMany({
              where: { id: candidate.id, status: 'CLEANING', leaseToken: token },
              data: {
                status: 'COMPLETED',
                completedAt: new Date(),
                leaseToken: null,
                leaseExpiresAt: null,
                lastError: null,
              },
            });
          }
          return true;
        }, { timeout: 15000 });
        if (finalized) result.accountsFinalized++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await prisma.accountDeletionJob.updateMany({
          where: { id: candidate.id, status: 'CLEANING', leaseToken: token },
          data: {
            status: 'FAILED',
            attempts: { increment: 1 },
            lastError: message.slice(0, 4000),
            leaseToken: null,
            leaseExpiresAt: null,
          },
        });
        result.accountsBlocked++;
      }
    }
  }
}
