import { prisma } from '../../../config/database.js';
import { NotFoundError } from '../../../common/errors/app-error.js';
export class FoldersRepository {
    async createFolder(userId, name, id) {
        return prisma.folder.create({
            data: {
                ...(id ? { id } : {}),
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
    // `update`/`delete` only accept unique-field `where` clauses in Prisma, so
    // `userId` scoping can't be expressed there directly. `updateMany`/
    // `deleteMany` do support arbitrary `where` filters, so we use those to
    // enforce ownership at the query level (not just in the calling service),
    // and treat a zero-row match as "not found" rather than silently
    // succeeding on the wrong tenant's data.
    async updateFolder(id, userId, name) {
        const { count } = await prisma.folder.updateMany({
            where: { id, userId },
            data: { name },
        });
        if (count === 0) {
            throw new NotFoundError('Folder not found', 'FOLDER_NOT_FOUND');
        }
        return prisma.folder.findUniqueOrThrow({ where: { id } });
    }
    async deleteFolder(id, userId) {
        const { count } = await prisma.folder.deleteMany({
            where: { id, userId },
        });
        if (count === 0) {
            throw new NotFoundError('Folder not found', 'FOLDER_NOT_FOUND');
        }
    }
}
//# sourceMappingURL=folders.repository.js.map