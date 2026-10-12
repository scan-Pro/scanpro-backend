import { prisma } from '../../../config/database.js';

export interface PendingDeletionRecord {
  id: string;
  fileUrl: string;
  documentId: string | null;
  userId: string;
  attempts: number;
  lastError: string | null;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  createdAt: Date;
  updatedAt: Date;
}

export class PendingDeletionRepository {
  async createMany(entries: { fileUrl: string; documentId: string | null; userId: string }[]): Promise<void> {
    if (entries.length === 0) return;
    await prisma.pendingDeletion.createMany({
      data: entries.map((e) => ({
        fileUrl: e.fileUrl,
        documentId: e.documentId,
        userId: e.userId,
        status: 'PENDING',
      })),
      skipDuplicates: true,
    });
  }

  async markCompleted(id: string): Promise<void> {
    await prisma.pendingDeletion.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });
  }

  async markCompletedByUrl(fileUrl: string): Promise<void> {
    await prisma.pendingDeletion.updateMany({
      where: { fileUrl, status: 'PENDING' },
      data: { status: 'COMPLETED' },
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await prisma.pendingDeletion.update({
      where: { id },
      data: {
        status: 'FAILED',
        attempts: { increment: 1 },
        lastError: error.slice(0, 1000),
      },
    });
  }

  async markFailedByUrl(fileUrl: string, error: string): Promise<void> {
    await prisma.pendingDeletion.updateMany({
      where: { fileUrl, status: 'PENDING' },
      data: {
        status: 'FAILED',
        attempts: { increment: 1 },
        lastError: error.slice(0, 1000),
      },
    });
  }

  async markRetrying(id: string): Promise<void> {
    await prisma.pendingDeletion.update({
      where: { id },
      data: {
        status: 'PENDING',
        attempts: { increment: 1 },
      },
    });
  }

  async findPending(limit: number = 50): Promise<PendingDeletionRecord[]> {
    return prisma.pendingDeletion.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: limit,
    }) as Promise<PendingDeletionRecord[]>;
  }

  async findFailed(limit: number = 50, maxAttempts: number = 5): Promise<PendingDeletionRecord[]> {
    return prisma.pendingDeletion.findMany({
      where: {
        status: 'FAILED',
        attempts: { lt: maxAttempts },
      },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    }) as Promise<PendingDeletionRecord[]>;
  }

  async deleteOldCompleted(olderThanDays: number = 7): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const { count } = await prisma.pendingDeletion.deleteMany({
      where: {
        status: 'COMPLETED',
        updatedAt: { lt: cutoff },
      },
    });
    return count;
  }
}
