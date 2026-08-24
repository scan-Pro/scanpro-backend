import { Response, NextFunction } from 'express';
import { FoldersService } from '../service/folders.service.js';
import { ApiResponse } from '../../../common/response/api-response.js';
import { AuthenticatedRequest } from '../../../common/types/index.js';

export class FoldersController {
  constructor(private readonly foldersService: FoldersService = new FoldersService()) {}

  createFolder = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const folder = await this.foldersService.createFolder(userId, req.body);
      ApiResponse.created(res, 'Folder created successfully', folder);
    } catch (error) {
      next(error);
    }
  };

  getFolders = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const folders = await this.foldersService.getFolders(userId);
      ApiResponse.success(res, 'Folders fetched successfully', folders);
    } catch (error) {
      next(error);
    }
  };

  getFolderById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const id = req.params.id as string;
      const folder = await this.foldersService.getFolderById(id, userId);
      ApiResponse.success(res, 'Folder fetched successfully', folder);
    } catch (error) {
      next(error);
    }
  };

  updateFolder = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const id = req.params.id as string;
      const folder = await this.foldersService.updateFolder(id, userId, req.body);
      ApiResponse.success(res, 'Folder updated successfully', folder);
    } catch (error) {
      next(error);
    }
  };

  deleteFolder = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const id = req.params.id as string;
      await this.foldersService.deleteFolder(id, userId);
      ApiResponse.success(res, 'Folder deleted successfully');
    } catch (error) {
      next(error);
    }
  };
}
