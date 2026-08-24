import { Response, NextFunction } from 'express';
import { DocumentsService } from '../service/documents.service.js';
import { ApiResponse } from '../../../common/response/api-response.js';
import { AuthenticatedRequest } from '../../../common/types/index.js';

export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService = new DocumentsService()) {}

  createDocument = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const document = await this.documentsService.createDocument(userId, req.body);
      ApiResponse.created(res, 'Document created successfully', document);
    } catch (error) {
      next(error);
    }
  };

  getDocuments = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { q, folderId, favorite } = req.query as {
        q?: string;
        folderId?: string;
        favorite?: string;
      };

      const documents = await this.documentsService.getDocuments(userId, {
        q,
        folderId,
        isFavorite: favorite !== undefined ? favorite === 'true' : undefined,
      });

      ApiResponse.success(res, 'Documents fetched successfully', documents);
    } catch (error) {
      next(error);
    }
  };

  getDocumentById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const id = req.params.id as string;
      const document = await this.documentsService.getDocumentById(id, userId);
      ApiResponse.success(res, 'Document fetched successfully', document);
    } catch (error) {
      next(error);
    }
  };

  updateDocument = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const id = req.params.id as string;
      const document = await this.documentsService.updateDocument(id, userId, req.body);
      ApiResponse.success(res, 'Document updated successfully', document);
    } catch (error) {
      next(error);
    }
  };

  deleteDocument = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const id = req.params.id as string;
      await this.documentsService.deleteDocument(id, userId);
      ApiResponse.success(res, 'Document deleted successfully');
    } catch (error) {
      next(error);
    }
  };

  toggleFavorite = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const id = req.params.id as string;
      const { isFavorite } = req.body;
      const document = await this.documentsService.toggleFavorite(id, userId, isFavorite);
      ApiResponse.success(res, 'Favorite status updated successfully', document);
    } catch (error) {
      next(error);
    }
  };

  moveToFolder = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const id = req.params.id as string;
      const { folderId } = req.body;
      const document = await this.documentsService.moveToFolder(id, userId, folderId ?? null);
      ApiResponse.success(res, 'Document moved successfully', document);
    } catch (error) {
      next(error);
    }
  };
}
