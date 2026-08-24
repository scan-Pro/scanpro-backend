import { DocumentsRepository, DocumentWithRelations } from '../repository/documents.repository.js';
import { CreateDocumentDto, UpdateDocumentDto } from '../dto/documents.dto.js';
import { NotFoundError } from '../../../common/errors/app-error.js';

export class DocumentsService {
  constructor(private readonly documentsRepository: DocumentsRepository = new DocumentsRepository()) {}

  async createDocument(userId: string, dto: CreateDocumentDto): Promise<DocumentWithRelations> {
    return this.documentsRepository.createDocument(userId, dto);
  }

  async getDocuments(
    userId: string,
    filters?: {
      q?: string;
      folderId?: string;
      isFavorite?: boolean;
    }
  ): Promise<DocumentWithRelations[]> {
    return this.documentsRepository.findUserDocuments(userId, filters);
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
    await this.getDocumentById(id, userId);
    await this.documentsRepository.deleteDocument(id, userId);
  }

  async toggleFavorite(id: string, userId: string, isFavorite: boolean): Promise<DocumentWithRelations> {
    await this.getDocumentById(id, userId);
    return this.documentsRepository.toggleFavorite(id, userId, isFavorite);
  }

  async moveToFolder(id: string, userId: string, folderId: string | null): Promise<DocumentWithRelations> {
    await this.getDocumentById(id, userId);
    return this.documentsRepository.moveToFolder(id, userId, folderId);
  }
}
