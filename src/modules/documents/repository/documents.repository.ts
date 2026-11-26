import { prisma } from '../../../config/database.js';
import { Document, DocumentPage, Prisma } from '@prisma/client';
import { CreateDocumentDto, UpdateDocumentDto, QueryDocumentsDto } from '../dto/documents.dto.js';
import { ConflictError, NotFoundError } from '../../../common/errors/app-error.js';
import { assertUserActive } from '../../../common/utils/account-lifecycle.util.js';

export type DocumentWithRelations = Document & {
  folder: { id: string; name: string } | null;
  pages?: DocumentPage[];
};

export interface StorageObjectTarget {
  bucket: string;
  key: string;
}

export type ResolveOwnedObjectUrl = (url: string, userId: string) => StorageObjectTarget;

const documentIncludeFull = {
  folder: { select: { id: true, name: true } },
  pages: { orderBy: { pageOrder: 'asc' as const } },
};

const PRESIGNED_URL_SAFETY_MS = 65 * 60 * 1000;

export class DocumentsRepository {
  private async assertNotTombstoned(
    tx: Prisma.TransactionClient,
    userId: string,
    documentId: string,
  ): Promise<void> {
    const tombstone = await tx.documentTombstone.findUnique({
      where: { userId_documentId: { userId, documentId } },
      select: { id: true },
    });
    if (tombstone) {
      throw new ConflictError(
        'A deleted document cannot be recreated by a stale sync request',
        'DOCUMENT_DELETED',
      );
    }
  }

  private async writePages(
    tx: Prisma.TransactionClient,
    documentId: string,
    pages: CreateDocumentDto['pages'],
  ): Promise<void> {
    if (pages === undefined) return;
    await tx.documentPage.deleteMany({ where: { documentId } });
    if (pages.length === 0) return;
    await tx.documentPage.createMany({
      data: pages.map((p, idx) => ({
        ...(p.id ? { id: p.id } : {}),
        documentId,
        pageOrder: p.pageOrder ?? idx,
        imageUrl: p.imageUrl,
        thumbnailUrl: p.thumbnailUrl || null,
        filter: p.filter || 'ORIGINAL',
        rotation: p.rotation || 0,
      })),
    });
  }

  async createDocument(userId: string, data: CreateDocumentDto): Promise<DocumentWithRelations> {
    return prisma.$transaction(async (tx) => {
      await assertUserActive(tx, userId);
      if (data.id) {
        await this.assertNotTombstoned(tx, userId, data.id);
        const existing = await tx.document.findFirst({
          where: { id: data.id, userId },
          select: { id: true },
        });
        if (existing) {
          await tx.document.updateMany({
            where: { id: data.id, userId },
            data: {
              title: data.title,
              folderId: data.folderId || null,
              thumbnailUrl: data.thumbnailUrl || null,
              pdfUrl: data.pdfUrl || null,
              pageCount: data.pages ? data.pages.length : (data.pageCount || 1),
              isFavorite: data.isFavorite ?? false,
              updatedAt: new Date(),
            },
          });
          await this.writePages(tx, data.id, data.pages);
          return tx.document.findFirstOrThrow({
            where: { id: data.id, userId },
            include: documentIncludeFull,
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
      ...(filters?.q ? { title: { contains: filters.q } } : {}),
    };

    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit = filters?.limit && filters.limit > 0 ? filters.limit : 20;
    const skip = (page - 1) * limit;

    const [totalCount, documents] = await prisma.$transaction([
      prisma.document.count({ where }),
      prisma.document.findMany({
        where,
        include: { folder: { select: { id: true, name: true } } },
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

  async updateDocument(
    id: string,
    userId: string,
    data: UpdateDocumentDto,
  ): Promise<DocumentWithRelations> {
    return prisma.$transaction(async (tx) => {
      await assertUserActive(tx, userId);
      await this.assertNotTombstoned(tx, userId, id);
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
      if (count === 0) throw new NotFoundError('Document not found', 'DOCUMENT_NOT_FOUND');
      await this.writePages(tx, id, data.pages);
      return tx.document.findFirstOrThrow({
        where: { id, userId },
        include: documentIncludeFull,
      });
    });
  }

  async deleteDocument(
    id: string,
    userId: string,
    resolveObjectUrl: ResolveOwnedObjectUrl,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await assertUserActive(tx, userId);
      const document = await tx.document.findFirst({
        where: { id, userId },
        include: documentIncludeFull,
      });
      if (!document) throw new NotFoundError('Document not found', 'DOCUMENT_NOT_FOUND');

      // Tombstone and cleanup intents commit atomically with metadata deletion.
      await tx.documentTombstone.upsert({
        where: { userId_documentId: { userId, documentId: id } },
        create: { userId, documentId: id },
        update: {},
      });

      const urls = [
        document.thumbnailUrl,
        document.pdfUrl,
        ...(document.pages ?? []).flatMap((page) => [page.imageUrl, page.thumbnailUrl]),
      ].filter((value): value is string => typeof value === 'string' && /^https?:\/\//i.test(value));

      const targets = new Map<string, { fileUrl: string; bucket: string; key: string }>();
      const unsafe = new Map<string, string>();
      for (const url of urls) {
        try {
          const target = resolveObjectUrl(url, userId);
          targets.set(`${target.bucket}\u0000${target.key}`, { fileUrl: url, ...target });
        } catch (error) {
          unsafe.set(url, error instanceof Error ? error.message : 'Object URL could not be validated');
        }
      }

      const now = new Date();
      const safeDefaultTime = new Date(now.getTime() + PRESIGNED_URL_SAFETY_MS);
      for (const target of targets.values()) {
        const grants = await tx.uploadGrant.findMany({
          where: { userId, bucket: target.bucket, objectKey: target.key },
          select: { expiresAt: true },
        });
        const grantSafeTime = grants.length === 0
          ? safeDefaultTime
          : grants.reduce((latest, grant) => {
              const expiryWithMargin = new Date(grant.expiresAt.getTime() + 5 * 60 * 1000);
              return expiryWithMargin > latest ? expiryWithMargin : latest;
            }, now);
        await tx.pendingDeletion.create({
          data: {
            fileUrl: target.fileUrl,
            bucket: target.bucket,
            objectKey: target.key,
            documentId: id,
            userId,
            status: 'PENDING',
            availableAt: grantSafeTime,
          },
        });
      }

      for (const [fileUrl, reason] of unsafe) {
        await tx.pendingDeletion.create({
          data: {
            fileUrl,
            bucket: null,
            objectKey: null,
            documentId: id,
            userId,
            status: 'FAILED',
            lastError: `Requires operator inventory: ${reason}`,
          },
        });
      }

      const deleted = await tx.document.deleteMany({ where: { id, userId } });
      if (deleted.count !== 1) {
        throw new NotFoundError('Document not found', 'DOCUMENT_NOT_FOUND');
      }
    });
  }

  async toggleFavorite(id: string, userId: string, isFavorite: boolean): Promise<DocumentWithRelations> {
    return prisma.$transaction(async (tx) => {
      await assertUserActive(tx, userId);
      await this.assertNotTombstoned(tx, userId, id);
      const { count } = await tx.document.updateMany({
        where: { id, userId },
        data: { isFavorite, updatedAt: new Date() },
      });
      if (count === 0) throw new NotFoundError('Document not found', 'DOCUMENT_NOT_FOUND');
      return tx.document.findFirstOrThrow({ where: { id, userId }, include: documentIncludeFull });
    });
  }

  async moveToFolder(id: string, userId: string, folderId: string | null): Promise<DocumentWithRelations> {
    return prisma.$transaction(async (tx) => {
      await assertUserActive(tx, userId);
      await this.assertNotTombstoned(tx, userId, id);
      const { count } = await tx.document.updateMany({
        where: { id, userId },
        data: { folderId, updatedAt: new Date() },
      });
      if (count === 0) throw new NotFoundError('Document not found', 'DOCUMENT_NOT_FOUND');
      return tx.document.findFirstOrThrow({ where: { id, userId }, include: documentIncludeFull });
    });
  }
}
