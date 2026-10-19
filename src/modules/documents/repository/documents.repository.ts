import { prisma } from '../../../config/database.js';
import { Prisma, Document, DocumentPage } from '@prisma/client';
import { CreateDocumentDto, UpdateDocumentDto, QueryDocumentsDto } from '../dto/documents.dto.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../../common/errors/app-error.js';

export type DocumentWithRelations = Document & {
  folder: { id: string; name: string } | null;
  pages?: DocumentPage[];
};

const documentIncludeFull = {
  folder: { select: { id: true, name: true } },
  pages: { orderBy: { pageOrder: 'asc' as const } },
};

type Transaction = Prisma.TransactionClient;

export interface ResolvedStorageTarget {
  fileUrl: string | null;
  bucket: string | null;
  objectKey: string | null;
  objectIdentity: string | null;
}

async function lockActiveUser(tx: Transaction, userId: string): Promise<void> {
  // This owner-row lock serializes document writes with account-deletion start.
  const users = await tx.$queryRaw<Array<{ id: string; lifecycle_status: string }>>`
    SELECT id, lifecycle_status FROM users WHERE id = ${userId} FOR UPDATE
  `;
  if (users.length === 0) throw new NotFoundError('User not found', 'USER_NOT_FOUND');
  if (users[0].lifecycle_status !== 'ACTIVE') {
    throw new ForbiddenError('Account deletion is in progress', 'ACCOUNT_DELETING');
  }
}

async function assertNotTombstoned(tx: Transaction, userId: string, documentId: string): Promise<void> {
  const tombstone = await tx.documentTombstone.findUnique({
    where: { userId_documentId: { userId, documentId } },
  });
  if (tombstone) {
    throw new ConflictError('A deleted document ID cannot be reused', 'DOCUMENT_TOMBSTONED');
  }
}

function pageCreateData(pages: NonNullable<CreateDocumentDto['pages']>) {
  return pages.map((page) => ({
    ...(page.id ? { id: page.id } : {}),
    pageOrder: page.pageOrder,
    imageUrl: page.imageUrl,
    thumbnailUrl: page.thumbnailUrl || null,
    filter: page.filter || 'ORIGINAL',
    rotation: page.rotation || 0,
  }));
}

export class DocumentsRepository {
  async createDocument(userId: string, data: CreateDocumentDto): Promise<DocumentWithRelations> {
    return prisma.$transaction(async (tx) => {
      await lockActiveUser(tx, userId);
      if (data.id) {
        await assertNotTombstoned(tx, userId, data.id);
        const existing = await tx.document.findUnique({ where: { id: data.id } });
        if (existing && existing.userId !== userId) {
          throw new ConflictError('Document ID is already in use', 'DOCUMENT_ID_CONFLICT');
        }
        if (existing) {
          return tx.document.update({
            where: { id: data.id },
            data: {
              title: data.title,
              folderId: data.folderId || null,
              thumbnailUrl: data.thumbnailUrl || null,
              pdfUrl: data.pdfUrl || null,
              pageCount: data.pages !== undefined ? data.pages.length : (data.pageCount || 1),
              isFavorite: data.isFavorite ?? existing.isFavorite,
              updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
              ...(data.pages !== undefined
                ? { pages: { deleteMany: {}, ...(data.pages.length ? { create: pageCreateData(data.pages) } : {}) } }
                : {}),
            },
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
          pageCount: data.pages !== undefined ? data.pages.length : (data.pageCount || 1),
          isFavorite: data.isFavorite ?? false,
          ...(data.createdAt ? { createdAt: new Date(data.createdAt) } : {}),
          ...(data.updatedAt ? { updatedAt: new Date(data.updatedAt) } : {}),
          pages: data.pages && data.pages.length > 0 ? { create: pageCreateData(data.pages) } : undefined,
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

  async updateDocument(id: string, userId: string, data: UpdateDocumentDto): Promise<DocumentWithRelations> {
    return prisma.$transaction(async (tx) => {
      await lockActiveUser(tx, userId);
      await assertNotTombstoned(tx, userId, id);
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

      if (data.pages !== undefined) {
        await tx.documentPage.deleteMany({ where: { documentId: id } });
        if (data.pages.length > 0) {
          await tx.documentPage.createMany({
            data: data.pages.map((page, idx) => ({
              ...(page.id ? { id: page.id } : {}),
              documentId: id,
              pageOrder: page.pageOrder ?? idx,
              imageUrl: page.imageUrl,
              thumbnailUrl: page.thumbnailUrl || null,
              filter: page.filter || 'ORIGINAL',
              rotation: page.rotation || 0,
            })),
          });
        }
      }
      return tx.document.findFirstOrThrow({ where: { id, userId }, include: documentIncludeFull });
    });
  }

  async deleteDocument(
    id: string,
    userId: string,
    resolveTarget: (url: string) => ResolvedStorageTarget
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await lockActiveUser(tx, userId);

      const existing = await tx.document.findFirst({
        where: { id, userId },
        include: { pages: true },
      });
      if (!existing) {
        const tombstone = await tx.documentTombstone.findUnique({
          where: { userId_documentId: { userId, documentId: id } },
        });
        if (tombstone) return; // Idempotent retry after a previous delete.
        throw new NotFoundError('Document not found', 'DOCUMENT_NOT_FOUND');
      }

      const now = new Date();
      const legacySafeAfter = new Date(now.getTime() + 65 * 60 * 1000);
      await tx.documentTombstone.upsert({
        where: { userId_documentId: { userId, documentId: id } },
        create: { userId, documentId: id, deletedAt: now },
        update: { deletedAt: now },
      });

      const fileUrls = [
        existing.thumbnailUrl,
        existing.pdfUrl,
        ...existing.pages.flatMap((page) => [page.imageUrl, page.thumbnailUrl]),
      ].filter((url): url is string => Boolean(url && /^https?:\/\//i.test(url)));

      const targetByIdentity = new Map<string, {
        target: ResolvedStorageTarget;
        notBefore: Date;
      }>();
      const unresolvedTargets: ResolvedStorageTarget[] = [];

      for (const url of new Set(fileUrls)) {
        const target = resolveTarget(url);
        if (!target.bucket || !target.objectKey || !target.objectIdentity) {
          unresolvedTargets.push(target);
          continue;
        }
        const grant = await tx.uploadGrant.findFirst({
          where: {
            userId,
            bucket: target.bucket,
            objectKey: target.objectKey,
            objectIdentity: target.objectIdentity,
          },
          select: { expiresAt: true, cleanupDone: true },
        });
        const grantSafeAfter = grant
          ? new Date(grant.expiresAt.getTime() + 5 * 60 * 1000)
          : legacySafeAfter;
        const current = targetByIdentity.get(target.objectIdentity);
        targetByIdentity.set(target.objectIdentity, {
          target,
          notBefore: current && current.notBefore > grantSafeAfter ? current.notBefore : grantSafeAfter,
        });
      }

      if (targetByIdentity.size > 0) {
        await tx.pendingDeletion.createMany({
          data: [...targetByIdentity.values()].map(({ target, notBefore }) => ({
            fileUrl: target.fileUrl,
            bucket: target.bucket!,
            objectKey: target.objectKey!,
            objectIdentity: target.objectIdentity!,
            documentId: id,
            userId,
            status: 'PENDING',
            notBefore,
          })),
          skipDuplicates: true,
        });
        await tx.uploadGrant.updateMany({
          where: {
            userId,
            objectIdentity: { in: [...targetByIdentity.keys()] },
            cleanupDone: false,
          },
          data: { cleanupState: 'PENDING' },
        });
      }

      if (unresolvedTargets.length > 0) {
        await tx.pendingDeletion.createMany({
          data: unresolvedTargets.map((target) => ({
            fileUrl: target.fileUrl,
            bucket: null,
            objectKey: null,
            objectIdentity: null,
            documentId: id,
            userId,
            status: 'DEAD_LETTER',
            lastError: 'Storage URL could not be validated against the configured endpoint/bucket and owner key. Operator inventory required.',
          })),
          skipDuplicates: true,
        });
      }

      await tx.document.deleteMany({ where: { id, userId } });
    }, { timeout: 15000 });
  }

  async toggleFavorite(id: string, userId: string, isFavorite: boolean): Promise<DocumentWithRelations> {
    return prisma.$transaction(async (tx) => {
      await lockActiveUser(tx, userId);
      await assertNotTombstoned(tx, userId, id);
      const { count } = await tx.document.updateMany({ where: { id, userId }, data: { isFavorite } });
      if (count === 0) throw new NotFoundError('Document not found', 'DOCUMENT_NOT_FOUND');
      return tx.document.findFirstOrThrow({ where: { id, userId }, include: documentIncludeFull });
    });
  }

  async moveToFolder(id: string, userId: string, folderId: string | null): Promise<DocumentWithRelations> {
    return prisma.$transaction(async (tx) => {
      await lockActiveUser(tx, userId);
      await assertNotTombstoned(tx, userId, id);
      const { count } = await tx.document.updateMany({ where: { id, userId }, data: { folderId } });
      if (count === 0) throw new NotFoundError('Document not found', 'DOCUMENT_NOT_FOUND');
      return tx.document.findFirstOrThrow({ where: { id, userId }, include: documentIncludeFull });
    });
  }
}
