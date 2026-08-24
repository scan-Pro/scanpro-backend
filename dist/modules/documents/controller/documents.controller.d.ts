import { Response, NextFunction } from 'express';
import { DocumentsService } from '../service/documents.service.js';
import { AuthenticatedRequest } from '../../../common/types/index.js';
export declare class DocumentsController {
    private readonly documentsService;
    constructor(documentsService?: DocumentsService);
    createDocument: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    getDocuments: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    getDocumentById: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    updateDocument: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    deleteDocument: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    toggleFavorite: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    moveToFolder: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
}
