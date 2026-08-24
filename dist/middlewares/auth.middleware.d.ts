import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../common/types/index.js';
export declare const authenticate: (req: AuthenticatedRequest, _res: Response, next: NextFunction) => void;
