import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { prisma } from '../../../config/database.js';
import { assertUserActive } from '../../../common/utils/account-lifecycle.util.js';
import { ForbiddenError } from '../../../common/errors/app-error.js';
import { s3Client } from '../../../config/aws.js';
import { env } from '../../../config/env.js';
import { GetPresignedUrlDto, PresignedUrlResult } from '../dto/uploads.dto.js';

export interface StorageObjectTarget {
  bucket: string;
  key: string;
}

const allowedFolders = new Set(['documents', 'pages', 'thumbnails', 'pdfs']);

export class UploadsService {
  constructor(private readonly client: S3Client = s3Client) {}

  private publicFileUrl(key: string): string {
    if (env.AWS_ENDPOINT && env.AWS_ENDPOINT.includes('backblazeb2.com')) {
      return `https://s3.${env.AWS_REGION}.backblazeb2.com/${env.AWS_S3_BUCKET}/${key}`;
    }
    if (env.AWS_ENDPOINT.trim() !== '') {
      return `${env.AWS_ENDPOINT.replace(/\/$/, '')}/${env.AWS_S3_BUCKET}/${key}`;
    }
    return `https://s3.${env.AWS_REGION}.amazonaws.com/${env.AWS_S3_BUCKET}/${key}`;
  }

  async generatePresignedUploadUrl(userId: string, dto: GetPresignedUrlDto): Promise<PresignedUrlResult> {
    const folder = dto.folder || 'documents';
    if (!allowedFolders.has(folder)) {
      throw new ForbiddenError('Unsupported storage folder', 'INVALID_STORAGE_FOLDER');
    }

    // Derive the object extension from the validated MIME type, never from a
    // client-supplied filename/path.
    const extension = dto.fileType === 'application/pdf'
      ? 'pdf'
      : dto.fileType === 'image/png'
        ? 'png'
        : dto.fileType === 'image/webp'
          ? 'webp'
          : 'jpg';
    const uniqueKey = `${folder}/${userId}/${crypto.randomUUID()}.${extension}`;
    const expiresIn = 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    const fileUrl = this.publicFileUrl(uniqueKey);

    // Persist the grant under the same account lifecycle lock used by deletion
    // before the URL is returned. If URL signing fails, the durable grant is
    // still available for safe expiry-aware cleanup.
    await prisma.$transaction(async (tx) => {
      await assertUserActive(tx, userId);
      await tx.uploadGrant.create({
        data: {
          userId,
          bucket: env.AWS_S3_BUCKET,
          objectKey: uniqueKey,
          fileUrl,
          expiresAt,
          cleanupDone: false,
        },
      });
    });

    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: uniqueKey,
        ContentType: dto.fileType,
      }),
      { expiresIn },
    );

    return { uploadUrl, fileUrl, key: uniqueKey, expiresIn };
  }

  /**
   * Accept only URLs matching this application's configured public-object URL
   * format and an exact owner path. Never trust a caller-provided bucket/key.
   */
  resolveOwnedObjectUrl(fileUrl: string, userId: string): StorageObjectTarget {
    let actual: URL;
    let expectedBase: URL;
    try {
      actual = new URL(fileUrl);
      expectedBase = new URL(this.publicFileUrl('placeholder'));
    } catch {
      throw new ForbiddenError('Invalid cloud object URL', 'INVALID_FILE_URL');
    }

    const expectedPrefix = `/${env.AWS_S3_BUCKET}/`;
    if (
      actual.protocol !== 'https:' ||
      actual.origin !== expectedBase.origin ||
      !actual.pathname.startsWith(expectedPrefix)
    ) {
      throw new ForbiddenError('Object URL is outside configured storage', 'INVALID_FILE_URL');
    }

    let key: string;
    try {
      key = decodeURIComponent(actual.pathname.slice(expectedPrefix.length));
    } catch {
      throw new ForbiddenError('Malformed object key', 'INVALID_FILE_URL');
    }

    const segments = key.split('/');
    if (
      segments.length !== 3 ||
      !allowedFolders.has(segments[0]) ||
      segments[1] !== userId ||
      !segments[2] ||
      segments.some((part) => !part || part === '.' || part === '..')
    ) {
      throw new ForbiddenError('Object URL does not belong to the current user', 'INVALID_FILE_URL');
    }

    return { bucket: env.AWS_S3_BUCKET, key };
  }

  /**
   * Resolve a previously persisted file URL for deletion. This is still
   * constrained to the configured origin/bucket and canonical key structure.
   * Account/document owners are validated by the caller before this method.
   */
  resolveConfiguredObjectUrl(fileUrl: string): StorageObjectTarget {
    let actual: URL;
    let expectedBase: URL;
    try {
      actual = new URL(fileUrl);
      expectedBase = new URL(this.publicFileUrl('placeholder'));
    } catch {
      throw new ForbiddenError('Invalid cloud object URL', 'INVALID_FILE_URL');
    }

    const prefix = `/${env.AWS_S3_BUCKET}/`;
    if (actual.protocol !== 'https:' || actual.origin !== expectedBase.origin || !actual.pathname.startsWith(prefix)) {
      throw new ForbiddenError('Object URL is outside configured storage', 'INVALID_FILE_URL');
    }

    let key: string;
    try {
      key = decodeURIComponent(actual.pathname.slice(prefix.length));
    } catch {
      throw new ForbiddenError('Malformed object key', 'INVALID_FILE_URL');
    }

    const segments = key.split('/');
    if (
      segments.length !== 3 ||
      !allowedFolders.has(segments[0]) ||
      !segments[1] ||
      !segments[2] ||
      segments.some((part) => !part || part === '.' || part === '..')
    ) {
      throw new ForbiddenError('Object key is not canonical', 'INVALID_FILE_URL');
    }
    return { bucket: env.AWS_S3_BUCKET, key };
  }

  async deleteObject(bucket: string, key: string, expectedUserId: string): Promise<void> {
    if (bucket !== env.AWS_S3_BUCKET) {
      throw new ForbiddenError('Refusing to delete from an unconfigured bucket', 'INVALID_STORAGE_BUCKET');
    }
    const segments = key.split('/');
    if (
      segments.length !== 3 ||
      !allowedFolders.has(segments[0]) ||
      !segments[1] ||
      segments[1] !== expectedUserId ||
      !segments[2] ||
      segments.some((part) => !part || part === '.' || part === '..')
    ) {
      throw new ForbiddenError('Refusing to delete a non-canonical or unowned object key', 'INVALID_OBJECT_KEY');
    }
    // S3 DeleteObject is idempotent for a missing key. Intentionally propagate
    // errors so the durable worker can retry instead of falsely marking success.
    await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  async deleteFileByUrl(fileUrl: string, userId: string): Promise<void> {
    const target = this.resolveOwnedObjectUrl(fileUrl, userId);
    await this.deleteObject(target.bucket, target.key, userId);
  }
}
