import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../config/database.js';

export interface PendingDeletionRecord {
  id: string;
  fileUrl: string;
  bucket: string;
  objectKey: string;
  documentId: string | null;
  userId: string;
  attempts: number;
  lastError: string | null;
  leaseToken: string | null;
  leaseUntil: Date | null;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'DEAD_LETTER';
  createdAt: Date;
  updatedAt: Date;
}

export interface PendingDeletionInput {
  fileUrl: string;
  bucket: string;
  objectKey: string;
  documentId: string | null;
  userId: string;
}

export class PendingDeletionRepository {
  async createMany(entries: PendingDeletionInput[]): Promise<void> {
    if (entries.length === 0) return;
    await prisma.pendingDeletion.createMany({
      data: entries.map((entry) => ({ ...entry, status: 'PENDING' })),
      skipDuplicates: true,
    });
  }

  async createManyInTransaction(
    tx: Prisma.TransactionClient,
    entries: PendingDeletionInput[],
  ): Promise<void> {
    for (const entry of entries) {
      await tx.pendingDeletion.upsert({
        where: { bucket_objectKey: { bucket: entry.bucket, objectKey: entry.objectKey } },
        create: { ...entry, status: 'PENDING' },
        update: {},
      });
    }
  }

  async claimBatch(
    limit = 50,
    leaseMs = 60_000,
    userId?: string,
  ): Promise<PendingDeletionRecord[]> {
    return prisma.$transaction(async (tx) => {
      const now = new Date();
      const candidates = await tx.pendingDeletion.findMany({
        where: {
          ...(userId ? { userId } : {}),
          status: { in: ['PENDING', 'FAILED'] },
          attempts: { lt: 10 },
          OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });
      const claimed: PendingDeletionRecord[] = [];
      for (const record of candidates) {
        const token = randomUUID();
        const result = await tx.pendingDeletion.updateMany({
          where: {
            id: record.id,
            ...(userId ? { userId } : {}),
            status: { in: ['PENDING', 'FAILED'] },
            OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
          },
          data: { status: 'PENDING', leaseToken: token, leaseUntil: new Date(now.getTime() + leaseMs) },
        });
        if (result.count === 1) {
          claimed.push({ ...record, leaseToken: token, leaseUntil: new Date(now.getTime() + leaseMs) } as PendingDeletionRecord);
        }
      }
      return claimed;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async markCompleted(id: string, leaseToken: string): Promise<boolean> {
    const result = await prisma.pendingDeletion.updateMany({
      where: { id, status: 'PENDING', leaseToken },
      data: { status: 'COMPLETED', leaseToken: null, leaseUntil: null, lastError: null },
    });
    return result.count === 1;
  }

  async markFailed(id: string, leaseToken: string, error: string): Promise<'FAILED' | 'DEAD_LETTER' | null> {
    const current = await prisma.pendingDeletion.findFirst({
      where: { id, status: 'PENDING', leaseToken },
      select: { attempts: true },
    });
    if (!current) return null;
    const nextStatus = current.attempts + 1 >= 10 ? 'DEAD_LETTER' : 'FAILED';
    const result = await prisma.pendingDeletion.updateMany({
      where: { id, status: 'PENDING', leaseToken },
      data: {
        status: nextStatus,
        attempts: { increment: 1 },
        lastError: error.slice(0, 1000),
        leaseToken: null,
        leaseUntil: null,
      },
    });
    return result.count === 1 ? nextStatus : null;
  }

  async requeue(id: string): Promise<boolean> {
    const result = await prisma.pendingDeletion.updateMany({
      where: { id, status: 'DEAD_LETTER' },
      data: { status: 'PENDING', attempts: 0, lastError: null, leaseToken: null, leaseUntil: null },
    });
    return result.count === 1;
  }

  async findUnfinishedForUser(userId: string) {
    return prisma.pendingDeletion.findMany({
      where: { userId, status: { not: 'COMPLETED' } },
      select: { bucket: true, objectKey: true },
    });
  }

  async deleteOldCompleted(olderThanDays = 7): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const result = await prisma.pendingDeletion.deleteMany({
      where: { status: 'COMPLETED', updatedAt: { lt: cutoff } },
    });
    return result.count;
  }
}
