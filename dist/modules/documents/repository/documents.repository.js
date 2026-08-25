import { prisma } from '../../../config/database.js';
export class DocumentsRepository {
    async createDocument(userId, data) {
        return prisma.document.create({
            data: {
                ...(data.id ? { id: data.id } : {}),
                userId,
                title: data.title,
                folderId: data.folderId || null,
                thumbnailUrl: data.thumbnailUrl || null,
                pdfUrl: data.pdfUrl || null,
                pageCount: data.pages ? data.pages.length : (data.pageCount || 1),
                isFavorite: data.isFavorite ?? false,
                ...(data.createdAt ? { createdAt: new Date(data.createdAt) } : {}),
                ...(data.updatedAt ? { updatedAt: new Date(data.updatedAt) } : {}),
                pages: data.pages && data.pages.length > 0
                    ? {
                        create: data.pages.map((p) => ({
                            ...(p.id ? { id: p.id } : {}),
                            pageOrder: p.pageOrder,
                            imageUrl: p.imageUrl,
                            thumbnailUrl: p.thumbnailUrl || null,
                            filter: p.filter || 'ORIGINAL',
                            rotation: p.rotation || 0,
                        })),
                    }
                    : undefined,
            },
            include: {
                folder: { select: { id: true, name: true } },
                pages: { orderBy: { pageOrder: 'asc' } },
            },
        });
    }
    async findUserDocuments(userId, filters) {
        return prisma.document.findMany({
            where: {
                userId,
                ...(filters?.folderId ? { folderId: filters.folderId } : {}),
                ...(filters?.isFavorite !== undefined ? { isFavorite: filters.isFavorite } : {}),
                ...(filters?.q
                    ? {
                        title: {
                            contains: filters.q,
                        },
                    }
                    : {}),
            },
            include: {
                folder: { select: { id: true, name: true } },
                pages: { orderBy: { pageOrder: 'asc' } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findById(id, userId) {
        return prisma.document.findFirst({
            where: { id, userId },
            include: {
                folder: { select: { id: true, name: true } },
                pages: { orderBy: { pageOrder: 'asc' } },
            },
        });
    }
    async updateDocument(id, userId, data) {
        return prisma.document.update({
            where: { id },
            data: {
                ...(data.title !== undefined ? { title: data.title } : {}),
                ...(data.folderId !== undefined ? { folderId: data.folderId } : {}),
                ...(data.thumbnailUrl !== undefined ? { thumbnailUrl: data.thumbnailUrl } : {}),
                ...(data.pdfUrl !== undefined ? { pdfUrl: data.pdfUrl } : {}),
                ...(data.pageCount !== undefined ? { pageCount: data.pageCount } : {}),
                ...(data.isFavorite !== undefined ? { isFavorite: data.isFavorite } : {}),
            },
            include: {
                folder: { select: { id: true, name: true } },
                pages: { orderBy: { pageOrder: 'asc' } },
            },
        });
    }
    async deleteDocument(id, userId) {
        await prisma.document.delete({
            where: { id },
        });
    }
    async toggleFavorite(id, userId, isFavorite) {
        return prisma.document.update({
            where: { id },
            data: { isFavorite },
            include: {
                folder: { select: { id: true, name: true } },
                pages: { orderBy: { pageOrder: 'asc' } },
            },
        });
    }
    async moveToFolder(id, userId, folderId) {
        return prisma.document.update({
            where: { id },
            data: { folderId },
            include: {
                folder: { select: { id: true, name: true } },
                pages: { orderBy: { pageOrder: 'asc' } },
            },
        });
    }
}
//# sourceMappingURL=documents.repository.js.map