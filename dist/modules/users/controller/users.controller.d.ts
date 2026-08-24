import { Response, NextFunction } from 'express';
import { UsersService } from '../service/users.service.js';
import { AuthenticatedRequest } from '../../../common/types/index.js';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService?: UsersService);
    getProfile: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    updateProfile: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    changePassword: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    deleteAccount: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
}
