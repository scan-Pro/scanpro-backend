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
    private readonly foldersRepository: FoldersRepository = new FoldersRepository()
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
    // The repository takes the owner lock, writes the tombstone, inventories
    // exact cleanup keys and deletes metadata in one transaction. No
    // fire-and-forget storage work occurs in the request path.
    await this.documentsRepository.deleteDocument(
      id,
      userId,
      (url) => this.uploadsService.resolveOwnedStorageUrl(url, userId)
    );
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
