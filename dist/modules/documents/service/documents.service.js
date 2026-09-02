import { DocumentsRepository } from '../repository/documents.repository.js';
import { NotFoundError } from '../../../common/errors/app-error.js';
import { assertOwnStorageUrl } from '../../../common/utils/storage-url.util.js';
import { UploadsService } from '../../uploads/service/uploads.service.js';
import { FoldersRepository } from '../../folders/repository/folders.repository.js';
export class DocumentsService {
    documentsRepository;
    uploadsService;
    foldersRepository;
    constructor(documentsRepository = new DocumentsRepository(), uploadsService = new UploadsService(), foldersRepository = new FoldersRepository()) {
        this.documentsRepository = documentsRepository;
        this.uploadsService = uploadsService;
        this.foldersRepository = foldersRepository;
    }
    async createDocument(userId, dto) {
        await this.assertFolderOwnership(dto.folderId, userId);
        this.assertOwnFileUrls(userId, dto);
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
        await this.assertFolderOwnership(dto.folderId, userId);
        this.assertOwnFileUrls(userId, dto);
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
        if (document.pages) {
            for (const page of document.pages) {
                if (page.imageUrl)
                    urlsToDelete.push(page.imageUrl);
                if (page.thumbnailUrl)
                    urlsToDelete.push(page.thumbnailUrl);
            }
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
        await this.assertFolderOwnership(folderId, userId);
        return this.documentsRepository.moveToFolder(id, userId, folderId);
    }
    /**
     * Ensures the given folder (if any) exists and belongs to the requesting
     * user, preventing a document from being attached to another user's
     * folder (IDOR). No-op when `folderId` is null/undefined.
     */
    async assertFolderOwnership(folderId, userId) {
        if (!folderId)
            return;
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
    assertOwnFileUrls(userId, dto) {
        assertOwnStorageUrl(dto.thumbnailUrl, userId, 'thumbnailUrl');
        assertOwnStorageUrl(dto.pdfUrl, userId, 'pdfUrl');
        for (const page of dto.pages ?? []) {
            assertOwnStorageUrl(page.imageUrl, userId, 'pages[].imageUrl');
            assertOwnStorageUrl(page.thumbnailUrl, userId, 'pages[].thumbnailUrl');
        }
    }
}
//# sourceMappingURL=documents.service.js.map