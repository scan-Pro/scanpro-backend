import { Response, NextFunction } from 'express';
import { UploadsService } from '../service/uploads.service.js';
import { ApiResponse } from '../../../common/response/api-response.js';
import { AuthenticatedRequest } from '../../../common/types/index.js';

export class UploadsController {
  constructor(private readonly uploadsService: UploadsService = new UploadsService()) {}

  getPresignedUrl = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const result = await this.uploadsService.generatePresignedUploadUrl(userId, req.body);
      ApiResponse.success(res, 'Presigned upload URL generated successfully', result);
    } catch (error) {
      next(error);
    }
  };
}
