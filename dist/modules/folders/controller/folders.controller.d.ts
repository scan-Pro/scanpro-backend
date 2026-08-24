import { Response, NextFunction } from 'express';
import { FoldersService } from '../service/folders.service.js';
import { AuthenticatedRequest } from '../../../common/types/index.js';
export declare class FoldersController {
    private readonly foldersService;
    constructor(foldersService?: FoldersService);
    createFolder: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    getFolders: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    getFolderById: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    updateFolder: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    deleteFolder: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
}
