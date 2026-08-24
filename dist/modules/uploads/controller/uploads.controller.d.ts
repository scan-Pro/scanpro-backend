import { Response, NextFunction } from 'express';
import { UploadsService } from '../service/uploads.service.js';
import { AuthenticatedRequest } from '../../../common/types/index.js';
export declare class UploadsController {
    private readonly uploadsService;
    constructor(uploadsService?: UploadsService);
    getPresignedUrl: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
}
