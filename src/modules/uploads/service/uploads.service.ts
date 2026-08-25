import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { s3Client } from '../../../config/aws.js';
import { env } from '../../../config/env.js';
import { GetPresignedUrlDto, PresignedUrlResult } from '../dto/uploads.dto.js';

export class UploadsService {
  async generatePresignedUploadUrl(userId: string, dto: GetPresignedUrlDto): Promise<PresignedUrlResult> {
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

      let fileUrl: string;
      if (env.AWS_ENDPOINT && env.AWS_ENDPOINT.includes('backblazeb2.com')) {
        fileUrl = `https://s3.${env.AWS_REGION}.backblazeb2.com/${env.AWS_S3_BUCKET}/${uniqueKey}`;
      } else if (env.AWS_ENDPOINT && env.AWS_ENDPOINT.trim() !== '') {
        fileUrl = `${env.AWS_ENDPOINT}/${env.AWS_S3_BUCKET}/${uniqueKey}`;
      } else {
        fileUrl = `https://s3.${env.AWS_REGION}.amazonaws.com/${env.AWS_S3_BUCKET}/${uniqueKey}`;
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

  /**
   * Extracts the S3 object key from a full public URL and deletes the file from B2/S3.
   * Safe to call even if credentials are not configured (no-op in that case).
   */
  async deleteFileByUrl(fileUrl: string): Promise<void> {
    if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY || !env.AWS_S3_BUCKET) {
      return; // No cloud storage configured
    }

    try {
      const key = this._extractKeyFromUrl(fileUrl);
      if (!key) return;

      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: env.AWS_S3_BUCKET,
          Key: key,
        })
      );
    } catch (err) {
      // Log but don't rethrow — a failed B2 delete must not block the DB delete
      console.error('[UploadsService] Failed to delete B2 file:', fileUrl, err);
    }
  }

  private _extractKeyFromUrl(url: string): string | null {
    try {
      const parsed = new URL(url);
      // pathname looks like  /<bucket>/<key>  or  /<key>  depending on endpoint style
      const parts = parsed.pathname.replace(/^\//, '').split('/');
      // If first segment matches bucket name, strip it
      if (parts[0] === env.AWS_S3_BUCKET) {
        return parts.slice(1).join('/');
      }
      return parts.join('/');
    } catch {
      return null;
    }
  }
}
