import { randomUUID } from 'node:crypto';
import { prisma } from '../../../config/database.js';
import { UploadsService } from '../../uploads/service/uploads.service.js';
import { PendingDeletionRepository } from '../../documents/repository/pending-deletion.repository.js';
import { getOwnedObjectKey } from '../../../common/utils/storage-url.util.js';
import { UsersRepository } from '../repository/users.repository.js';

const leaseMs = 60_000;
const expirySafetyMs = 60_000;
const maxAttempts = 10;

export class AccountDeletionWorkerService {
  constructor(
    private readonly uploadsService: UploadsService = new UploadsService(),
    private readonly pendingRepository: PendingDeletionRepository = new PendingDeletionRepository(),
    private readonly usersRepository: UsersRepository = new UsersRepository(),
  ) {}

  async runOnce(limit = 25): Promise<{ processed: number; completed: number; failed: number }> {
    const jobs = await this._claimJobs(limit);
    let completed = 0;
    let failed = 0;
    for (const job of jobs) {
      try {
        const maxExpiry = await prisma.uploadGrant.aggregate({
          where: { userId: job.userId, cleanupDone: false },
          _max: { expiresAt: true },
        });
        if (maxExpiry._max.expiresAt &&
            maxExpiry._max.expiresAt.getTime() + expirySafetyMs > Date.now()) {
          await this._releaseJob(job.id, job.leaseToken, 'Waiting for outstanding upload grants to expire.');
          continue;
        }

        await this._queueAllOwnedObjects(job.userId);
        await this._processFileJobsForUser(job.userId);
        const pending = await this.pendingRepository.findUnfinishedForUser(job.userId);
        if (pending.length > 0) {
          await this._releaseJob(job.id, job.leaseToken, `${pending.length} object cleanup job(s) remain.`);
          continue;
        }

        await prisma.$transaction(async (tx) => {
          const current = await tx.accountDeletionJob.findFirst({
            where: { id: job.id, leaseToken: job.leaseToken, status: 'PENDING' },
          });
          if (!current) return;
          await tx.user.deleteMany({ where: { id: job.userId, lifecycleStatus: 'DELETING' } });
        });
        completed++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this._releaseJob(job.id, job.leaseToken, message, true);
        failed++;
      }
    }

    return { processed: jobs.length, completed, failed };
  }

  private async _claimJobs(limit: number) {
    return prisma.$transaction(async (tx) => {
      const now = new Date();
      const rows = await tx.accountDeletionJob.findMany({
        where: {
          status: { in: ['PENDING', 'FAILED'] },
          attempts: { lt: maxAttempts },
          OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });
      const claimed = [];
      for (const row of rows) {
        const leaseToken = randomUUID();
        const result = await tx.accountDeletionJob.updateMany({
          where: {
            id: row.id,
            status: { in: ['PENDING', 'FAILED'] },
            OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
          },
          data: {
            status: 'PENDING',
            leaseToken,
            leaseUntil: new Date(now.getTime() + leaseMs),
          },
        });
        if (result.count === 1) claimed.push({ ...row, leaseToken });
      }
      return claimed;
    }, { isolationLevel: 'Serializable' });
  }

  private async _queueAllOwnedObjects(userId: string): Promise<void> {
    const docs = await prisma.document.findMany({ where: { userId }, include: { pages: true } });
    const keys = new Map<string, { bucket: string; objectKey: string; userId: string; documentId: string | null; fileUrl: string }>();
    const addUrl = (url: string | null, documentId: string | null) => {
      if (!url) return;
      const object = getOwnedObjectKey(url, userId);
      if (!object) return;
      keys.set(`${object.bucket}\0${object.objectKey}`, {
        ...object,
        userId,
        documentId,
        fileUrl: url,
      });
    };

    for (const doc of docs) {
      addUrl(doc.thumbnailUrl, doc.id);
      addUrl(doc.pdfUrl, doc.id);
      for (const page of doc.pages) {
        addUrl(page.imageUrl, doc.id);
        addUrl(page.thumbnailUrl, doc.id);
      }
    }
    const grants = await prisma.uploadGrant.findMany({ where: { userId, cleanupDone: false } });
    for (const grant of grants) {
      if (grant.userId === userId) {
        keys.set(`${grant.bucket}\0${grant.objectKey}`, {
          bucket: grant.bucket,
          objectKey: grant.objectKey,
          userId,
          documentId: null,
          fileUrl: this.uploadsService.fileUrlForKey(grant.objectKey),
        });
      }
    }
    await this.pendingRepository.createMany([...keys.values()]);
  }

  private async _releaseJob(
    id: string,
    leaseToken: string,
    error: string,
    incrementAttempt = false,
  ): Promise<void> {
    const current = await prisma.accountDeletionJob.findFirst({
      where: { id, leaseToken, status: 'PENDING' },
      select: { attempts: true },
    });
    if (!current) return;
    const attempts = current.attempts + (incrementAttempt ? 1 : 0);
    await prisma.accountDeletionJob.updateMany({
      where: { id, leaseToken, status: 'PENDING' },
      data: {
        status: attempts >= maxAttempts ? 'DEAD_LETTER' : 'FAILED',
        attempts,
        lastError: error.slice(0, 1000),
        leaseToken: null,
        leaseUntil: null,
      },
    });
  }
}
