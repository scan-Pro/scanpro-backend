import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { s3Client } from '../../../config/aws.js';
import { env } from '../../../config/env.js';
import { prisma } from '../../../config/database.js';
import { ForbiddenError } from '../../../common/errors/app-error.js';
import { GetPresignedUrlDto, PresignedUrlResult } from '../dto/uploads.dto.js';

export interface StorageCleanupTarget {
  fileUrl: string | null;
  bucket: string | null;
  objectKey: string | null;
  objectIdentity: string | null;
}

export function makeObjectIdentity(bucket: string, objectKey: string): string {
  return crypto.createHash('sha256').update(`${bucket}\0${objectKey}`).digest('hex');
}

function safeObjectKey(key: string): boolean {
  if (!key || key.includes('\\') || key.includes('\0')) return false;
  const segments = key.split('/');
  return segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

export class UploadsService {
  async generatePresignedUploadUrl(userId: string, dto: GetPresignedUrlDto): Promise<PresignedUrlResult> {
    const folder = dto.folder || 'documents';
    const folderSegments = folder.split('/');
    if (
      folderSegments.length === 0 ||
      folderSegments.some((part) => !/^[A-Za-z0-9_-]{1,64}$/.test(part))
    ) {
      throw new Error('Invalid upload folder');
    }

    const extensionByMime: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
    };
    const extension = extensionByMime[dto.fileType];
    if (!extension) throw new Error('Unsupported upload file type');

    const uniqueKey = `${folder}/${userId}/${crypto.randomUUID()}.${extension}`;
    const expiresIn = 3600;
    const command = new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: uniqueKey,
      ContentType: dto.fileType,
    });
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });

    const fileUrl = env.AWS_ENDPOINT && env.AWS_ENDPOINT.trim() !== ''
      ? `${env.AWS_ENDPOINT.replace(/\/$/, '')}/${env.AWS_S3_BUCKET}/${uniqueKey}`
      : `https://s3.${env.AWS_REGION}.amazonaws.com/${env.AWS_S3_BUCKET}/${uniqueKey}`;

    // The grant is committed while holding the same owner-row lock used by
    // account deletion. The URL is not returned unless the grant is durable.
    await prisma.$transaction(async (tx) => {
      const users = await tx.$queryRaw<Array<{ id: string; lifecycle_status: string }>>`
        SELECT id, lifecycle_status FROM users WHERE id = ${userId} FOR UPDATE
      `;
      if (!users.length || users[0].lifecycle_status !== 'ACTIVE') {
        throw new ForbiddenError('Account deletion is in progress', 'ACCOUNT_DELETING');
      }
      await tx.uploadGrant.create({
        data: {
          userId,
          bucket: env.AWS_S3_BUCKET,
          objectKey: uniqueKey,
          objectIdentity: makeObjectIdentity(env.AWS_S3_BUCKET, uniqueKey),
          fileUrl,
          expiresAt: new Date(Date.now() + expiresIn * 1000),
        },
      });
    });

    return { uploadUrl, fileUrl, key: uniqueKey, expiresIn };
  }

  /**
   * Resolves only storage URLs generated for this user's objects and the
   * configured bucket. Unknown legacy URLs are returned as unresolved rather
   * than guessed, so cleanup can be held for operator review.
   */
  resolveOwnedStorageUrl(fileUrl: string, userId: string): StorageCleanupTarget {
    const unresolved: StorageCleanupTarget = {
      fileUrl,
      bucket: null,
      objectKey: null,
      objectIdentity: null,
    };
    try {
      const parsed = new URL(fileUrl);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return unresolved;

      const allowedHosts = new Set<string>();
      if (env.AWS_ENDPOINT) {
        try { allowedHosts.add(new URL(env.AWS_ENDPOINT).host.toLowerCase()); } catch { /* invalid endpoint */ }
      }
      allowedHosts.add(`s3.${env.AWS_REGION}.amazonaws.com`.toLowerCase());
      allowedHosts.add(`s3.${env.AWS_REGION}.backblazeb2.com`.toLowerCase());
      if (!allowedHosts.has(parsed.host.toLowerCase())) return unresolved;

      const pathSegments = parsed.pathname.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment));
      if (pathSegments.some((segment) => !segment || segment.includes('/') || segment.includes('\\') || segment === '.' || segment === '..')) {
        return unresolved;
      }
      const keySegments = pathSegments[0] === env.AWS_S3_BUCKET ? pathSegments.slice(1) : pathSegments;
      const objectKey = keySegments.join('/');
      if (!safeObjectKey(objectKey) || !keySegments.includes(userId)) return unresolved;

      return {
        fileUrl,
        bucket: env.AWS_S3_BUCKET,
        objectKey,
        objectIdentity: makeObjectIdentity(env.AWS_S3_BUCKET, objectKey),
      };
    } catch {
      return unresolved;
    }
  }

  /** Storage deletion errors intentionally propagate so durable jobs can retry. */
  async deleteFileByKey(bucket: string, objectKey: string): Promise<void> {
    if (bucket !== env.AWS_S3_BUCKET || !safeObjectKey(objectKey)) {
      throw new Error('Rejected invalid storage cleanup target');
    }
    await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
  }

}
