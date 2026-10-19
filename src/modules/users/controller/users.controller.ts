import { Response, NextFunction } from 'express';
import { UsersService } from '../service/users.service.js';
import { ApiResponse } from '../../../common/response/api-response.js';
import { AuthenticatedRequest } from '../../../common/types/index.js';

export class UsersController {
  constructor(private readonly usersService: UsersService = new UsersService()) {}

  getProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const profile = await this.usersService.getProfile(req.user!.userId);
      ApiResponse.success(res, 'Profile fetched successfully', profile);
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const updated = await this.usersService.updateProfile(req.user!.userId, req.body);
      ApiResponse.success(res, 'Profile updated successfully', updated);
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.usersService.changePassword(req.user!.userId, req.body);
      ApiResponse.success(res, 'Password changed successfully');
    } catch (error) {
      next(error);
    }
  };

  deleteAccount = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.usersService.deleteAccount(req.user!.userId);
      if (result.status === 'COMPLETED') {
        ApiResponse.success(res, 'Account deletion was already completed', result, 200);
        return;
      }
      // 202 reflects that cleanup is durably queued but still asynchronous.
      ApiResponse.success(res, 'Account deletion accepted; cleanup is continuing', result, 202);
    } catch (error) {
      next(error);
    }
  };
}
