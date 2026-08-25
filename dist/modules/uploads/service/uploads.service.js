import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { s3Client } from '../../../config/aws.js';
import { env } from '../../../config/env.js';
export class UploadsService {
    async generatePresignedUploadUrl(userId, dto) {
        const fileExtension = dto.fileName.split('.').pop() || 'jpg';
        const uniqueKey = `${dto.folder || 'documents'}/${userId}/${crypto.randomUUID()}.${fileExtension}`;
        const expiresIn = 3600; // 1 hour
        // If AWS / Backblaze B2 credentials are provided, generate true presigned S3 URL
        if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
            const command = new PutObjectCommand({
                Bucket: env.AWS_S3_BUCKET,
                Key: uniqueKey,
                ContentType: dto.fileType,
            });
            const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });
            let fileUrl;
            if (env.AWS_ENDPOINT && env.AWS_ENDPOINT.includes('backblazeb2.com')) {
                fileUrl = `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.backblazeb2.com/${uniqueKey}`;
            }
            else if (env.AWS_ENDPOINT && env.AWS_ENDPOINT.trim() !== '') {
                fileUrl = `${env.AWS_ENDPOINT}/${env.AWS_S3_BUCKET}/${uniqueKey}`;
            }
            else {
                fileUrl = `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${uniqueKey}`;
            }
            return {
                uploadUrl,
                fileUrl,
                key: uniqueKey,
                expiresIn,
            };
        }
        // Local / Dev Fallback Mock URL
        const mockUploadUrl = `http://localhost:${env.PORT}/api/v1/uploads/mock-direct-upload?key=${encodeURIComponent(uniqueKey)}`;
        const mockFileUrl = `http://localhost:${env.PORT}/uploads/${uniqueKey}`;
        return {
            uploadUrl: mockUploadUrl,
            fileUrl: mockFileUrl,
            key: uniqueKey,
            expiresIn,
        };
    }
}
//# sourceMappingURL=uploads.service.js.map