import { prisma } from '../../../config/database.js';
export class DocumentsRepository {
    async createDocument(userId, data) {
        if (data.id) {
            const existing = await prisma.document.findFirst({
                where: { id: data.id, userId },
            });
            if (existing) {
                return this.updateDocument(data.id, userId, {
                    title: data.title,
                    folderId: data.folderId,
                    thumbnailUrl: data.thumbnailUrl,
                    pdfUrl: data.pdfUrl,
                    pageCount: data.pages ? data.pages.length : (data.pageCount || 1),
                    isFavorite: data.isFavorite,
                    pages: data.pages,
                });
            }
        }
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
        const where = {
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
        };
        const page = filters?.page && filters.page > 0 ? filters.page : 1;
        const limit = filters?.limit && filters.limit > 0 ? filters.limit : 20;
        const skip = (page - 1) * limit;
        const [totalCount, documents] = await prisma.$transaction([
            prisma.document.count({ where }),
            prisma.document.findMany({
                where,
                include: {
                    folder: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
        ]);
        return { documents, totalCount };
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
        return prisma.$transaction(async (tx) => {
            if (data.pages !== undefined) {
                await tx.documentPage.deleteMany({
                    where: { documentId: id },
                });
                if (data.pages.length > 0) {
                    await tx.documentPage.createMany({
                        data: data.pages.map((p, idx) => ({
                            ...(p.id ? { id: p.id } : {}),
                            documentId: id,
                            pageOrder: p.pageOrder ?? idx,
                            imageUrl: p.imageUrl,
                            thumbnailUrl: p.thumbnailUrl || null,
                            filter: p.filter || 'ORIGINAL',
                            rotation: p.rotation || 0,
                        })),
                    });
                }
            }
            return tx.document.update({
                where: { id },
                data: {
                    ...(data.title !== undefined ? { title: data.title } : {}),
                    ...(data.folderId !== undefined ? { folderId: data.folderId } : {}),
                    ...(data.thumbnailUrl !== undefined ? { thumbnailUrl: data.thumbnailUrl } : {}),
                    ...(data.pdfUrl !== undefined ? { pdfUrl: data.pdfUrl } : {}),
                    ...(data.pageCount !== undefined
                        ? { pageCount: data.pageCount }
                        : data.pages !== undefined
                            ? { pageCount: data.pages.length }
                            : {}),
                    ...(data.isFavorite !== undefined ? { isFavorite: data.isFavorite } : {}),
                    updatedAt: new Date(),
                },
                include: {
                    folder: { select: { id: true, name: true } },
                    pages: { orderBy: { pageOrder: 'asc' } },
                },
            });
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