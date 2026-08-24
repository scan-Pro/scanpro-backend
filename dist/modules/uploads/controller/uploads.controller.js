import { UploadsService } from '../service/uploads.service.js';
import { ApiResponse } from '../../../common/response/api-response.js';
export class UploadsController {
    uploadsService;
    constructor(uploadsService = new UploadsService()) {
        this.uploadsService = uploadsService;
    }
    getPresignedUrl = async (req, res, next) => {
        try {
            const userId = req.user.userId;
            const result = await this.uploadsService.generatePresignedUploadUrl(userId, req.body);
            ApiResponse.success(res, 'Presigned upload URL generated successfully', result);
        }
        catch (error) {
            next(error);
        }
    };
}
//# sourceMappingURL=uploads.controller.js.map