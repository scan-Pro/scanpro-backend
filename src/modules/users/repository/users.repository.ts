import { prisma } from '../../../config/database.js';
import { User, Prisma } from '@prisma/client';
import { ForbiddenError, NotFoundError } from '../../../common/errors/app-error.js';
import type { StorageCleanupTarget } from '../../uploads/service/uploads.service.js';

export class UsersRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async updateProfile(id: string, data: { name?: string; passwordHash?: string }): Promise<User> {
    return prisma.$transaction(async (tx) => {
      const users = await tx.$queryRaw<Array<{ id: string; lifecycle_status: string }>>`
        SELECT id, lifecycle_status FROM users WHERE id = ${id} FOR UPDATE
      `;
      if (!users.length) throw new NotFoundError('User not found', 'USER_NOT_FOUND');
      if (users[0].lifecycle_status !== 'ACTIVE') {
        throw new ForbiddenError('Account deletion is in progress', 'ACCOUNT_DELETING');
      }
      return tx.user.update({ where: { id }, data });
    });
  }

  /**
   * Marks the owner as deleting and records every safely resolvable object
   * before the HTTP request returns. Inventory and state transition commit
   * in one transaction under the same owner-row lock used by document writes
   * and upload grant issuance.
   */
  async beginAccountDeletion(
    userId: string,
    resolveUrl: (url: string, userId: string) => StorageCleanupTarget
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const userRows = await tx.$queryRaw<Array<{ id: string; lifecycle_status: string }>>`
        SELECT id, lifecycle_status FROM users WHERE id = ${userId} FOR UPDATE
      `;
      if (!userRows.length) throw new NotFoundError('User not found', 'USER_NOT_FOUND');

      const existingJob = await tx.accountDeletionJob.findUnique({ where: { userId } });
      if (userRows[0].lifecycle_status === 'DELETING' && existingJob) {
        // Duplicate DELETE is safe; the durable worker owns the existing job.
        return;
      }
      if (existingJob?.status === 'COMPLETED') {
        throw new ForbiddenError('Account deletion has already completed', 'ACCOUNT_DELETION_COMPLETED');
      }

      await tx.user.update({
        where: { id: userId },
        data: { lifecycleStatus: 'DELETING', deletionStartedAt: new Date() },
      });
      await tx.accountDeletionJob.upsert({
        where: { userId },
        create: { userId, status: 'PENDING', startedAt: new Date() },
        update: { status: 'PENDING', lastError: null, leaseToken: null, leaseExpiresAt: null },
      });

      const [documents, grants] = await Promise.all([
        tx.document.findMany({
          where: { userId },
          include: { pages: true },
        }),
        tx.uploadGrant.findMany({ where: { userId, cleanupDone: false } }),
      ]);

      // Keep all issued URLs usable until their expiry plus a small margin.
      // For legacy file URLs without a grant row, wait a full maximum grant
      // lifetime plus margin from deletion start before deleting the key.
      const legacySafeAfter = new Date(Date.now() + 65 * 60 * 1000);
      const targets = new Map<string, {
        fileUrl: string | null;
        bucket: string | null;
        objectKey: string | null;
        objectIdentity: string | null;
        documentId: string | null;
        userId: string;
        status: 'PENDING' | 'DEAD_LETTER';
        notBefore: Date | null;
        lastError?: string;
      }>();

      const addUrl = (url: string | null | undefined, documentId: string | null) => {
        if (!url || !/^https?:\/\//i.test(url)) return; // Local-only file path.
        const target = resolveUrl(url, userId);
        if (target.bucket && target.objectKey && target.objectIdentity) {
          const key = target.objectIdentity;
          if (!targets.has(key)) {
            targets.set(key, {
              ...target,
              documentId,
              userId,
              status: 'PENDING',
              notBefore: legacySafeAfter,
            });
          }
        } else {
          // There is no safe bucket/key to delete. Preserve it for operator
          // inventory rather than guessing from an untrusted URL.
          const identity = `unresolved:${userId}:${documentId ?? 'account'}:${url}`;
          targets.set(identity, {
            fileUrl: url,
            bucket: null,
            objectKey: null,
            objectIdentity: null,
            documentId,
            userId,
            status: 'DEAD_LETTER',
            notBefore: null,
            lastError: 'Legacy cleanup target could not be validated; operator inventory required.',
          });
        }
      };

      for (const document of documents) {
        addUrl(document.thumbnailUrl, document.id);
        addUrl(document.pdfUrl, document.id);
        for (const page of document.pages) {
          addUrl(page.imageUrl, document.id);
          addUrl(page.thumbnailUrl, document.id);
        }
      }

      for (const grant of grants) {
        const identity = grant.objectIdentity;
        const existing = targets.get(identity);
        const safeAfter = new Date(Math.max(grant.expiresAt.getTime() + 5 * 60 * 1000, Date.now()));
        targets.set(identity, {
          fileUrl: grant.fileUrl,
          bucket: grant.bucket,
          objectKey: grant.objectKey,
          objectIdentity: identity,
          documentId: existing?.documentId ?? null,
          userId,
          status: 'PENDING',
          notBefore: existing?.notBefore && existing.notBefore > safeAfter ? existing.notBefore : safeAfter,
        });
      }

      const queue = [...targets.values()];
      if (queue.length) {
        await tx.pendingDeletion.createMany({
          data: queue.map((target) => ({
            fileUrl: target.fileUrl,
            bucket: target.bucket,
            objectKey: target.objectKey,
            objectIdentity: target.objectIdentity,
            documentId: target.documentId,
            userId: target.userId,
            status: target.status,
            notBefore: target.notBefore,
            lastError: target.lastError,
          })),
          skipDuplicates: true,
        });
      }
      await tx.uploadGrant.updateMany({
        where: { userId, cleanupDone: false },
        data: { cleanupState: 'PENDING' },
      });
    }, { timeout: 15000 });
  }

  async deleteUser(id: string): Promise<void> {
    await prisma.user.delete({ where: { id } });
  }
}
