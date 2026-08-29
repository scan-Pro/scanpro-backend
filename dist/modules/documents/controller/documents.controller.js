import { DocumentsService } from '../service/documents.service.js';
import { ApiResponse } from '../../../common/response/api-response.js';
export class DocumentsController {
    documentsService;
    constructor(documentsService = new DocumentsService()) {
        this.documentsService = documentsService;
    }
    createDocument = async (req, res, next) => {
        try {
            const userId = req.user.userId;
            const document = await this.documentsService.createDocument(userId, req.body);
            ApiResponse.created(res, 'Document created successfully', document);
        }
        catch (error) {
            next(error);
        }
    };
    getDocuments = async (req, res, next) => {
        try {
            const userId = req.user.userId;
            const { q, folderId, favorite, page, limit } = req.query;
            const pageNum = page !== undefined ? Number(page) : 1;
            const limitNum = limit !== undefined ? Number(limit) : 20;
            const result = await this.documentsService.getDocuments(userId, {
                q,
                folderId,
                isFavorite: favorite !== undefined ? favorite === 'true' : undefined,
                page: pageNum,
                limit: limitNum,
            });
            ApiResponse.success(res, 'Documents fetched successfully', result);
        }
        catch (error) {
            next(error);
        }
    };
    getDocumentById = async (req, res, next) => {
        try {
            const userId = req.user.userId;
            const id = req.params.id;
            const document = await this.documentsService.getDocumentById(id, userId);
            ApiResponse.success(res, 'Document fetched successfully', document);
        }
        catch (error) {
            next(error);
        }
    };
    updateDocument = async (req, res, next) => {
        try {
            const userId = req.user.userId;
            const id = req.params.id;
            const document = await this.documentsService.updateDocument(id, userId, req.body);
            ApiResponse.success(res, 'Document updated successfully', document);
        }
        catch (error) {
            next(error);
        }
    };
    deleteDocument = async (req, res, next) => {
        try {
            const userId = req.user.userId;
            const id = req.params.id;
            await this.documentsService.deleteDocument(id, userId);
            ApiResponse.success(res, 'Document deleted successfully');
        }
        catch (error) {
            next(error);
        }
    };
    toggleFavorite = async (req, res, next) => {
        try {
            const userId = req.user.userId;
            const id = req.params.id;
            const { isFavorite } = req.body;
            const document = await this.documentsService.toggleFavorite(id, userId, isFavorite);
            ApiResponse.success(res, 'Favorite status updated successfully', document);
        }
        catch (error) {
            next(error);
        }
    };
    moveToFolder = async (req, res, next) => {
        try {
            const userId = req.user.userId;
            const id = req.params.id;
            const { folderId } = req.body;
            const document = await this.documentsService.moveToFolder(id, userId, folderId ?? null);
            ApiResponse.success(res, 'Document moved successfully', document);
        }
        catch (error) {
            next(error);
        }
    };
}
//# sourceMappingURL=documents.controller.js.map