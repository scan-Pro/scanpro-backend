import { GetPresignedUrlDto, PresignedUrlResult } from '../dto/uploads.dto.js';
export declare class UploadsService {
    generatePresignedUploadUrl(userId: string, dto: GetPresignedUrlDto): Promise<PresignedUrlResult>;
    /**
     * Extracts the S3 object key from a full public URL and deletes the file from B2/S3.
     * Safe to call even if credentials are not configured (no-op in that case).
     */
    deleteFileByUrl(fileUrl: string): Promise<void>;
    private _extractKeyFromUrl;
}
