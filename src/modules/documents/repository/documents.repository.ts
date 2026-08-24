import { prisma } from '../../../config/database.js';
import { Document, DocumentPage } from '@prisma/client';
import { CreateDocumentDto, UpdateDocumentDto } from '../dto/documents.dto.js';

export type DocumentWithRelations = Document & {
  folder: { id: string; name: string } | null;
  pages: DocumentPage[];
};

export class DocumentsRepository {
  async createDocument(userId: string, data: CreateDocumentDto): Promise<DocumentWithRelations> {
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

  async findUserDocuments(
    userId: string,
    filters?: {
      q?: string;
      folderId?: string;
      isFavorite?: boolean;
    }
  ): Promise<DocumentWithRelations[]> {
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
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findById(id: string, userId: string): Promise<DocumentWithRelations | null> {
    return prisma.document.findFirst({
      where: { id, userId },
      include: {
        folder: { select: { id: true, name: true } },
        pages: { orderBy: { pageOrder: 'asc' } },
      },
    });
  }

  async updateDocument(
    id: string,
    userId: string,
    data: UpdateDocumentDto
  ): Promise<DocumentWithRelations> {
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

  async deleteDocument(id: string, userId: string): Promise<void> {
    await prisma.document.delete({
      where: { id },
    });
  }

  async toggleFavorite(id: string, userId: string, isFavorite: boolean): Promise<DocumentWithRelations> {
    return prisma.document.update({
      where: { id },
      data: { isFavorite },
      include: {
        folder: { select: { id: true, name: true } },
        pages: { orderBy: { pageOrder: 'asc' } },
      },
    });
  }

  async moveToFolder(id: string, userId: string, folderId: string | null): Promise<DocumentWithRelations> {
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
