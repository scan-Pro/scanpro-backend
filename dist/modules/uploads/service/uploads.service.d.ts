import { GetPresignedUrlDto, PresignedUrlResult } from '../dto/uploads.dto.js';
export declare class UploadsService {
    generatePresignedUploadUrl(userId: string, dto: GetPresignedUrlDto): Promise<PresignedUrlResult>;
}
