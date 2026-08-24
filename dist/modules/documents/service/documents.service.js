import { DocumentsRepository } from '../repository/documents.repository.js';
import { NotFoundError } from '../../../common/errors/app-error.js';
export class DocumentsService {
    documentsRepository;
    constructor(documentsRepository = new DocumentsRepository()) {
        this.documentsRepository = documentsRepository;
    }
    async createDocument(userId, dto) {
        return this.documentsRepository.createDocument(userId, dto);
    }
    async getDocuments(userId, filters) {
        return this.documentsRepository.findUserDocuments(userId, filters);
    }
    async getDocumentById(id, userId) {
        const document = await this.documentsRepository.findById(id, userId);
        if (!document) {
            throw new NotFoundError('Document not found', 'DOCUMENT_NOT_FOUND');
        }
        return document;
    }
    async updateDocument(id, userId, dto) {
        await this.getDocumentById(id, userId);
        return this.documentsRepository.updateDocument(id, userId, dto);
    }
    async deleteDocument(id, userId) {
        await this.getDocumentById(id, userId);
        await this.documentsRepository.deleteDocument(id, userId);
    }
    async toggleFavorite(id, userId, isFavorite) {
        await this.getDocumentById(id, userId);
        return this.documentsRepository.toggleFavorite(id, userId, isFavorite);
    }
    async moveToFolder(id, userId, folderId) {
        await this.getDocumentById(id, userId);
        return this.documentsRepository.moveToFolder(id, userId, folderId);
    }
}
//# sourceMappingURL=documents.service.js.map