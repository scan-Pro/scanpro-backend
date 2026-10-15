import { prisma } from '../../../config/database.js';
import { Prisma } from '@prisma/client';
import { Document, DocumentPage } from '@prisma/client';
import { CreateDocumentDto, UpdateDocumentDto, QueryDocumentsDto } from '../dto/documents.dto.js';
import { NotFoundError } from '../../../common/errors/app-error.js';

export type DocumentWithRelations = Document & {
  folder: { id: string; name: string } | null;
  pages?: DocumentPage[];
};

const documentIncludeFull = {
  folder: { select: { id: true, name: true } },
  pages: { orderBy: { pageOrder: 'asc' as const } },
};

export class DocumentsRepository {
  async createDocument(userId: string, data: CreateDocumentDto): Promise<DocumentWithRelations> {
    return prisma.$transaction((tx) => this.createDocumentInTransaction(tx, userId, data));
  }

  async createDocumentInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    data: CreateDocumentDto,
  ): Promise<DocumentWithRelations> {
    if (data.id) {
      const tombstone = await tx.documentDeletionTombstone.findUnique({
        where: { userId_documentId: { userId, documentId: data.id } },
      });
      if (tombstone) {
        throw new NotFoundError('Deleted document IDs cannot be reused', 'DOCUMENT_DELETED');
      }
      const existing = await tx.document.findFirst({ where: { id: data.id, userId } });
      if (existing) {
        return this.updateDocumentInTransaction(tx, data.id, userId, {
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

    return tx.document.create({
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
      include: documentIncludeFull,
    });
  }

  async findUserDocuments(
    userId: string,
    filters?: QueryDocumentsDto
  ): Promise<{ documents: DocumentWithRelations[]; totalCount: number }> {
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

  async findById(id: string, userId: string): Promise<DocumentWithRelations | null> {
    return prisma.document.findFirst({
      where: { id, userId },
      include: documentIncludeFull,
    });
  }

  // `update`/`delete` only accept unique-field `where` clauses in Prisma, so
  // `userId` scoping can't be expressed there directly. `updateMany`/
  // `deleteMany` do support arbitrary `where` filters, so every mutation
  // below enforces ownership at the query level (not just in the calling
  // service), and treats a zero-row match as "not found" rather than
  // silently succeeding on — or leaking — another tenant's data.
  async updateDocument(
    id: string,
    userId: string,
    data: UpdateDocumentDto
  ): Promise<DocumentWithRelations> {
    return prisma.$transaction((tx) => this.updateDocumentInTransaction(tx, id, userId, data));
  }

  async updateDocumentInTransaction(
    tx: Prisma.TransactionClient,
    id: string,
    userId: string,
    data: UpdateDocumentDto,
  ): Promise<DocumentWithRelations> {
      const { count } = await tx.document.updateMany({
        where: { id, userId },
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
      });

      if (count === 0) {
        throw new NotFoundError('Document not found', 'DOCUMENT_NOT_FOUND');
      }

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

    return tx.document.findUniqueOrThrow({
      where: { id },
      include: documentIncludeFull,
    });
  }

  async deleteDocument(id: string, userId: string): Promise<void> {
    const { count } = await prisma.document.deleteMany({
      where: { id, userId },
    });
    if (count === 0) {
      throw new NotFoundError('Document not found', 'DOCUMENT_NOT_FOUND');
    }
  }

  async toggleFavorite(id: string, userId: string, isFavorite: boolean): Promise<DocumentWithRelations> {
    const { count } = await prisma.document.updateMany({
      where: { id, userId },
      data: { isFavorite },
    });
    if (count === 0) {
      throw new NotFoundError('Document not found', 'DOCUMENT_NOT_FOUND');
    }
    return prisma.document.findUniqueOrThrow({
      where: { id },
      include: documentIncludeFull,
    });
  }

  async moveToFolder(id: string, userId: string, folderId: string | null): Promise<DocumentWithRelations> {
    const { count } = await prisma.document.updateMany({
      where: { id, userId },
      data: { folderId },
    });
    if (count === 0) {
      throw new NotFoundError('Document not found', 'DOCUMENT_NOT_FOUND');
    }
    return prisma.document.findUniqueOrThrow({
      where: { id },
      include: documentIncludeFull,
    });
  }
}
