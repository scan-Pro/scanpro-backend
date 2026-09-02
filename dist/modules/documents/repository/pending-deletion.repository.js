import { prisma } from '../../../config/database.js';
export class PendingDeletionRepository {
    async createMany(entries) {
        if (entries.length === 0)
            return;
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
    async markCompleted(id) {
        await prisma.pendingDeletion.update({
            where: { id },
            data: { status: 'COMPLETED' },
        });
    }
    async markFailed(id, error) {
        await prisma.pendingDeletion.update({
            where: { id },
            data: {
                status: 'FAILED',
                attempts: { increment: 1 },
                lastError: error.slice(0, 1000),
            },
        });
    }
    async markRetrying(id) {
        await prisma.pendingDeletion.update({
            where: { id },
            data: {
                status: 'PENDING',
                attempts: { increment: 1 },
            },
        });
    }
    async findPending(limit = 50) {
        return prisma.pendingDeletion.findMany({
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'asc' },
            take: limit,
        });
    }
    async findFailed(limit = 50, maxAttempts = 5) {
        return prisma.pendingDeletion.findMany({
            where: {
                status: 'FAILED',
                attempts: { lt: maxAttempts },
            },
            orderBy: { updatedAt: 'asc' },
            take: limit,
        });
    }
    async deleteOldCompleted(olderThanDays = 7) {
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
//# sourceMappingURL=pending-deletion.repository.js.map