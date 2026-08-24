import { prisma } from '../../../config/database.js';
export class FoldersRepository {
    async createFolder(userId, name) {
        return prisma.folder.create({
            data: {
                userId,
                name,
            },
        });
    }
    async findUserFolders(userId) {
        return prisma.folder.findMany({
            where: { userId },
            include: {
                _count: {
                    select: { documents: true },
                },
            },
            orderBy: { name: 'asc' },
        });
    }
    async findById(id, userId) {
        return prisma.folder.findFirst({
            where: { id, userId },
        });
    }
    async findByName(userId, name) {
        return prisma.folder.findFirst({
            where: { userId, name },
        });
    }
    async updateFolder(id, userId, name) {
        return prisma.folder.update({
            where: { id },
            data: { name },
        });
    }
    async deleteFolder(id, userId) {
        await prisma.folder.delete({
            where: { id },
        });
    }
}
//# sourceMappingURL=folders.repository.js.map