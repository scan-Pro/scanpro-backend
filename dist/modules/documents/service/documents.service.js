import { DocumentsRepository } from '../repository/documents.repository.js';
import { NotFoundError } from '../../../common/errors/app-error.js';
import { UploadsService } from '../../uploads/service/uploads.service.js';
export class DocumentsService {
    documentsRepository;
    uploadsService;
    constructor(documentsRepository = new DocumentsRepository(), uploadsService = new UploadsService()) {
        this.documentsRepository = documentsRepository;
        this.uploadsService = uploadsService;
    }
    async createDocument(userId, dto) {
        return this.documentsRepository.createDocument(userId, dto);
    }
    async getDocuments(userId, filters) {
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
        const document = await this.getDocumentById(id, userId);
        // Collect all B2 file URLs to delete (thumbnail, pdf, each page image + thumbnail)
        const urlsToDelete = [];
        if (document.thumbnailUrl)
            urlsToDelete.push(document.thumbnailUrl);
        if (document.pdfUrl)
            urlsToDelete.push(document.pdfUrl);
        for (const page of document.pages) {
            if (page.imageUrl)
                urlsToDelete.push(page.imageUrl);
            if (page.thumbnailUrl)
                urlsToDelete.push(page.thumbnailUrl);
        }
        // Delete DB record first (fast), then clean up B2 files in background
        await this.documentsRepository.deleteDocument(id, userId);
        // Fire-and-forget B2 cleanup — failures are logged but don't break the response
        Promise.allSettled(urlsToDelete
            .filter((u) => u.startsWith('http'))
            .map((url) => this.uploadsService.deleteFileByUrl(url))).catch(() => { });
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