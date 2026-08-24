import { Response, NextFunction } from 'express';
import { UsersService } from '../service/users.service.js';
import { ApiResponse } from '../../../common/response/api-response.js';
import { AuthenticatedRequest } from '../../../common/types/index.js';

export class UsersController {
  constructor(private readonly usersService: UsersService = new UsersService()) {}

  getProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const profile = await this.usersService.getProfile(userId);
      ApiResponse.success(res, 'Profile fetched successfully', profile);
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const updated = await this.usersService.updateProfile(userId, req.body);
      ApiResponse.success(res, 'Profile updated successfully', updated);
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      await this.usersService.changePassword(userId, req.body);
      ApiResponse.success(res, 'Password changed successfully');
    } catch (error) {
      next(error);
    }
  };

  deleteAccount = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      await this.usersService.deleteAccount(userId);
      ApiResponse.success(res, 'Account deleted successfully');
    } catch (error) {
      next(error);
    }
  };
}
