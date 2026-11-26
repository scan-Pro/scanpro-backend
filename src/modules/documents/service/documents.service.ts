import { DocumentsRepository, DocumentWithRelations } from '../repository/documents.repository.js';
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
  ) {}

  async createDocument(userId: string, dto: CreateDocumentDto): Promise<DocumentWithRelations> {
    await this.assertFolderOwnership(dto.folderId, userId);
    await this.assertOwnFileUrls(userId, dto);
    return this.documentsRepository.createDocument(userId, dto);
  }

  async getDocuments(
    userId: string,
    filters?: QueryDocumentsDto
  ): Promise<PaginatedDocumentsResult<DocumentWithRelations>> {
    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit = filters?.limit && filters.limit > 0 ? filters.limit : 20;
    const { documents, totalCount } = await this.documentsRepository.findUserDocuments(userId, {
      ...filters, page, limit,
    });
    const totalPages = Math.ceil(totalCount / limit);
    return {
      documents,
      pagination: {
        page, limit, totalCount, totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async getDocumentById(id: string, userId: string): Promise<DocumentWithRelations> {
    const document = await this.documentsRepository.findById(id, userId);
    if (!document) throw new NotFoundError('Document not found', 'DOCUMENT_NOT_FOUND');
    return document;
  }

  async updateDocument(
    id: string,
    userId: string,
    dto: UpdateDocumentDto
  ): Promise<DocumentWithRelations> {
    await this.assertFolderOwnership(dto.folderId, userId);
    await this.assertOwnFileUrls(userId, dto);
    // The repository repeats ownership/tombstone/lifecycle checks under the
    // owner row lock; this avoids a stale preflight read authorizing a write.
    return this.documentsRepository.updateDocument(id, userId, dto);
  }

  async deleteDocument(id: string, userId: string): Promise<void> {
    await this.documentsRepository.deleteDocument(
      id,
      userId,
      (url, ownerId) => this.uploadsService.resolveOwnedObjectUrl(url, ownerId),
    );
  }

  async toggleFavorite(id: string, userId: string, isFavorite: boolean): Promise<DocumentWithRelations> {
    return this.documentsRepository.toggleFavorite(id, userId, isFavorite);
  }

  async moveToFolder(id: string, userId: string, folderId: string | null): Promise<DocumentWithRelations> {
    await this.assertFolderOwnership(folderId, userId);
    return this.documentsRepository.moveToFolder(id, userId, folderId);
  }

  private async assertFolderOwnership(
    folderId: string | null | undefined,
    userId: string
  ): Promise<void> {
    if (!folderId) return;
    const folder = await this.foldersRepository.findById(folderId, userId);
    if (!folder) throw new NotFoundError('Target folder not found', 'FOLDER_NOT_FOUND');
  }

  private async assertOwnFileUrls(
    userId: string,
    dto: { thumbnailUrl?: string | null; pdfUrl?: string | null; pages?: CreateDocumentPageDto[] }
  ): Promise<void> {
    const values: Array<[string | null | undefined, string]> = [
      [dto.thumbnailUrl, 'thumbnailUrl'],
      [dto.pdfUrl, 'pdfUrl'],
      ...(dto.pages ?? []).flatMap((page) => [
        [page.imageUrl, 'pages[].imageUrl'] as [string | null | undefined, string],
        [page.thumbnailUrl, 'pages[].thumbnailUrl'] as [string | null | undefined, string],
      ]),
    ];
    for (const [url, field] of values) {
      if (!url) continue;
      assertOwnStorageUrl(url, userId, field);
      // The URL must also match the configured storage origin, bucket, and
      // canonical owner-key layout; an arbitrary URL containing userId is not enough.
      this.uploadsService.resolveOwnedObjectUrl(url, userId);
    }
  }
}
