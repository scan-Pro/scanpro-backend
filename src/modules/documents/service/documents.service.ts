import { DocumentsRepository, DocumentWithRelations } from '../repository/documents.repository.js';
import { PendingDeletionRepository } from '../repository/pending-deletion.repository.js';
import { CreateDocumentDto, UpdateDocumentDto, QueryDocumentsDto, PaginatedDocumentsResult, CreateDocumentPageDto } from '../dto/documents.dto.js';
import { NotFoundError } from '../../../common/errors/app-error.js';
import { assertOwnStorageUrl } from '../../../common/utils/storage-url.util.js';
import { UploadsService } from '../../uploads/service/uploads.service.js';
import { FoldersRepository } from '../../folders/repository/folders.repository.js';

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
    return this.documentsRepository.createDocument(userId, dto);
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
    await this.getDocumentById(id, userId);
    await this.assertFolderOwnership(dto.folderId, userId);
    this.assertOwnFileUrls(userId, dto);
    return this.documentsRepository.updateDocument(id, userId, dto);
  }

  async deleteDocument(id: string, userId: string): Promise<void> {
    const document = await this.getDocumentById(id, userId);

    // Collect all B2 file URLs to delete (thumbnail, pdf, each page image + thumbnail)
    const urlsToDelete: string[] = [];
    if (document.thumbnailUrl) urlsToDelete.push(document.thumbnailUrl);
    if (document.pdfUrl) urlsToDelete.push(document.pdfUrl);
    if (document.pages) {
      for (const page of document.pages) {
        if (page.imageUrl) urlsToDelete.push(page.imageUrl);
        if (page.thumbnailUrl) urlsToDelete.push(page.thumbnailUrl);
      }
    }

    // Persist pending deletions so failed B2 deletes can be retried later
    const cloudUrls = urlsToDelete.filter((u) => u.startsWith('http'));
    if (cloudUrls.length > 0) {
      await this.pendingDeletionRepository.createMany(
        cloudUrls.map((url) => ({ fileUrl: url, documentId: id, userId }))
      );
    }

    // Delete DB record
    await this.documentsRepository.deleteDocument(id, userId);

    // Fire-and-forget B2 cleanup — failures are logged and recorded for retry
    if (cloudUrls.length > 0) {
      this._cleanupB2Files(cloudUrls, id);
    }
  }

  /**
   * Attempts to delete B2 files, logging failures and updating the
   * pending-deletion records so failed deletes can be retried later.
   */
  private _cleanupB2Files(urls: string[], documentId: string): void {
    Promise.allSettled(
      urls.map((url) => this.uploadsService.deleteFileByUrl(url))
    ).then(async (results) => {
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const url = urls[i];
        if (result.status === 'fulfilled') {
          await this.pendingDeletionRepository.markCompletedByUrl(url);
        } else {
          const errorMsg = (result as PromiseRejectedResult).reason?.message ?? 'Unknown error';
          console.warn(
            `[DocumentsService] B2 deletion failed for document ${documentId} (${url}):`,
            errorMsg
          );
          await this.pendingDeletionRepository.markFailedByUrl(url, errorMsg);
        }
      }
    });
  }

  /**
   * Retries pending/failed B2 deletions. Can be called by a cron job or
   * on startup. Returns the number of deletions processed.
   */
  async retryPendingDeletions(limit: number = 50): Promise<{ processed: number; succeeded: number; failed: number }> {
    const pending = await this.pendingDeletionRepository.findPending(limit);
    const failed = await this.pendingDeletionRepository.findFailed(limit);
    const toRetry = [...pending, ...failed].slice(0, limit);

    let succeeded = 0;
    let failedCount = 0;

    for (const record of toRetry) {
      await this.pendingDeletionRepository.markRetrying(record.id);
      try {
        await this.uploadsService.deleteFileByUrl(record.fileUrl);
        await this.pendingDeletionRepository.markCompleted(record.id);
        succeeded++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        await this.pendingDeletionRepository.markFailed(record.id, errorMessage);
        console.error(
          `[DocumentsService] Retry failed for B2 deletion ${record.id} (${record.fileUrl}):`,
          errorMessage
        );
        failedCount++;
      }
    }

    return { processed: toRetry.length, succeeded, failed: failedCount };
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
