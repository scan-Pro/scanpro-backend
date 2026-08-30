import { DocumentsRepository, DocumentWithRelations } from '../repository/documents.repository.js';
import { CreateDocumentDto, UpdateDocumentDto, QueryDocumentsDto, PaginatedDocumentsResult } from '../dto/documents.dto.js';
import { NotFoundError } from '../../../common/errors/app-error.js';
import { UploadsService } from '../../uploads/service/uploads.service.js';
import { FoldersRepository } from '../../folders/repository/folders.repository.js';

export class DocumentsService {
  constructor(
    private readonly documentsRepository: DocumentsRepository = new DocumentsRepository(),
    private readonly uploadsService: UploadsService = new UploadsService(),
    private readonly foldersRepository: FoldersRepository = new FoldersRepository()
  ) {}

  async createDocument(userId: string, dto: CreateDocumentDto): Promise<DocumentWithRelations> {
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

    // Delete DB record first (fast), then clean up B2 files in background
    await this.documentsRepository.deleteDocument(id, userId);

    // Fire-and-forget B2 cleanup — failures are logged but don't break the response
    Promise.allSettled(
      urlsToDelete
        .filter((u) => u.startsWith('http'))
        .map((url) => this.uploadsService.deleteFileByUrl(url))
    ).catch(() => {});
  }

  async toggleFavorite(id: string, userId: string, isFavorite: boolean): Promise<DocumentWithRelations> {
    await this.getDocumentById(id, userId);
    return this.documentsRepository.toggleFavorite(id, userId, isFavorite);
  }

  async moveToFolder(id: string, userId: string, folderId: string | null): Promise<DocumentWithRelations> {
    await this.getDocumentById(id, userId);
    if (folderId) {
      const folder = await this.foldersRepository.findById(folderId, userId);
      if (!folder) {
        throw new NotFoundError('Target folder not found', 'FOLDER_NOT_FOUND');
      }
    }
    return this.documentsRepository.moveToFolder(id, userId, folderId);
  }
}
