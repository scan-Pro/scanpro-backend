import { DocumentsRepository, DocumentWithRelations } from '../repository/documents.repository.js';
import { PendingDeletionRepository } from '../repository/pending-deletion.repository.js';
import { CreateDocumentDto, UpdateDocumentDto, QueryDocumentsDto, PaginatedDocumentsResult, CreateDocumentPageDto } from '../dto/documents.dto.js';
import { NotFoundError } from '../../../common/errors/app-error.js';
import { assertOwnStorageUrl, getOwnedObjectKey } from '../../../common/utils/storage-url.util.js';
import { prisma } from '../../../config/database.js';
import { lockActiveUser } from '../../users/repository/users.repository.js';
import { UploadsService } from '../../uploads/service/uploads.service.js';
import { FoldersRepository } from '../../folders/repository/folders.repository.js';

function dedupeObjects<T extends { bucket: string; objectKey: string }>(objects: T[]): T[] {
  const seen = new Set<string>();
  return objects.filter((object) => {
    const key = `${object.bucket}\0${object.objectKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export class DocumentsService {
  constructor(
    private readonly documentsRepository: DocumentsRepository = new DocumentsRepository(),
    private readonly uploadsService: UploadsService = new UploadsService(),
    private readonly foldersRepository: FoldersRepository = new FoldersRepository(),
    private readonly pendingDeletionRepository: PendingDeletionRepository = new PendingDeletionRepository()
  ) {}

  async createDocument(userId: string, dto: CreateDocumentDto): Promise<DocumentWithRelations> {
    await this.assertFolderOwnership(dto.folderId, userId);
    this.assertOwnFileUrls(userId, dto);
    return prisma.$transaction(async (tx) => {
      await lockActiveUser(tx, userId);
      return this.documentsRepository.createDocumentInTransaction(tx, userId, dto);
    });
  }

  async getDocuments(
    userId: string,
    filters?: QueryDocumentsDto
  ): Promise<PaginatedDocumentsResult<DocumentWithRelations>> {
    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit = filters?.limit && filters.limit > 0 ? filters.limit : 20;

    const { documents, totalCount } = await this.documentsRepository.findUserDocuments(userId, {
      ...filters,
      page,
      limit,
    });

    const totalPages = Math.ceil(totalCount / limit);

    return {
      documents,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async getDocumentById(id: string, userId: string): Promise<DocumentWithRelations> {
    const document = await this.documentsRepository.findById(id, userId);
    if (!document) {
      throw new NotFoundError('Document not found', 'DOCUMENT_NOT_FOUND');
    }
    return document;
  }

  async updateDocument(
    id: string,
    userId: string,
    dto: UpdateDocumentDto
  ): Promise<DocumentWithRelations> {
    await this.assertFolderOwnership(dto.folderId, userId);
    this.assertOwnFileUrls(userId, dto);
    return prisma.$transaction(async (tx) => {
      await lockActiveUser(tx, userId);
      const tombstone = await tx.documentDeletionTombstone.findUnique({
        where: { userId_documentId: { userId, documentId: id } },
      });
      if (tombstone) throw new NotFoundError('Document was deleted', 'DOCUMENT_DELETED');
      const existing = await tx.document.findFirst({
        where: { id, userId },
        select: { id: true },
      });
      if (!existing) throw new NotFoundError('Document not found', 'DOCUMENT_NOT_FOUND');
      return this.documentsRepository.updateDocumentInTransaction(tx, id, userId, dto);
    });
  }

  async deleteDocument(id: string, userId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await lockActiveUser(tx, userId);
      const document = await tx.document.findFirst({
        where: { id, userId },
        include: { pages: true },
      });
      if (!document) throw new NotFoundError('Document not found', 'DOCUMENT_NOT_FOUND');
      const urls = [document.thumbnailUrl, document.pdfUrl, ...document.pages.flatMap((page) => [page.imageUrl, page.thumbnailUrl])]
        .filter((url): url is string => Boolean(url));
      const objectKeys = dedupeObjects(urls.map((url) => getOwnedObjectKey(url, userId)).filter((value): value is NonNullable<typeof value> => value !== null));
      await tx.documentDeletionTombstone.upsert({
        where: { userId_documentId: { userId, documentId: id } },
        create: { userId, documentId: id },
        update: {},
      });
      await this.pendingDeletionRepository.createManyInTransaction(
        tx,
        objectKeys.map((object) => ({
          ...object,
          fileUrl: this.uploadsService.fileUrlForKey(object.objectKey),
          documentId: id,
          userId,
        })),
      );
      await tx.document.deleteMany({ where: { id, userId } });
    });
  }

  async retryPendingDeletions(limit = 50): Promise<{ processed: number; succeeded: number; failed: number }> {
    const records = await this.pendingDeletionRepository.claimBatch(limit);
    let succeeded = 0;
    let failed = 0;
    for (const record of records) {
      if (!record.leaseToken || !record.bucket || !record.objectKey) {
        await this.pendingDeletionRepository.markFailed(
          record.id,
          record.leaseToken ?? '',
          'Legacy deletion requires operator inventory reconciliation',
        );
        failed++;
        continue;
      }
      try {
        await this.uploadsService.deleteOwnedObject({ bucket: record.bucket, objectKey: record.objectKey });
        if (await this.pendingDeletionRepository.markCompleted(record.id, record.leaseToken)) succeeded++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const status = await this.pendingDeletionRepository.markFailed(record.id, record.leaseToken, message);
        if (status) failed++;
      }
    }
    return { processed: records.length, succeeded, failed };
  }

  async toggleFavorite(id: string, userId: string, isFavorite: boolean): Promise<DocumentWithRelations> {
    await this.getDocumentById(id, userId);
    return this.documentsRepository.toggleFavorite(id, userId, isFavorite);
  }

  async moveToFolder(id: string, userId: string, folderId: string | null): Promise<DocumentWithRelations> {
    await this.getDocumentById(id, userId);
    await this.assertFolderOwnership(folderId, userId);
    return this.documentsRepository.moveToFolder(id, userId, folderId);
  }

  /**
   * Ensures the given folder (if any) exists and belongs to the requesting
   * user, preventing a document from being attached to another user's
   * folder (IDOR). No-op when `folderId` is null/undefined.
   */
  private async assertFolderOwnership(
    folderId: string | null | undefined,
    userId: string
  ): Promise<void> {
    if (!folderId) return;
    const folder = await this.foldersRepository.findById(folderId, userId);
    if (!folder) {
      throw new NotFoundError('Target folder not found', 'FOLDER_NOT_FOUND');
    }
  }

  /**
   * Ensures every file URL in the payload (document thumbnail/PDF, and each
   * page's image/thumbnail) was actually issued to this user by
   * `UploadsService`, rather than trusting an arbitrary client-supplied
   * string — closing the gap where a document could reference another
   * tenant's storage objects (or a bogus non-cloud value).
   */
  private assertOwnFileUrls(
    userId: string,
    dto: { thumbnailUrl?: string | null; pdfUrl?: string | null; pages?: CreateDocumentPageDto[] }
  ): void {
    assertOwnStorageUrl(dto.thumbnailUrl, userId, 'thumbnailUrl');
    assertOwnStorageUrl(dto.pdfUrl, userId, 'pdfUrl');
    for (const page of dto.pages ?? []) {
      assertOwnStorageUrl(page.imageUrl, userId, 'pages[].imageUrl');
      assertOwnStorageUrl(page.thumbnailUrl, userId, 'pages[].thumbnailUrl');
    }
  }
}
