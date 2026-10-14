import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { prisma } from '../../../config/database.js';
import { s3Client } from '../../../config/aws.js';
import { env } from '../../../config/env.js';
import { GetPresignedUrlDto, PresignedUrlResult } from '../dto/uploads.dto.js';
import { getOwnedObjectKey, OwnedObjectKey } from '../../../common/utils/storage-url.util.js';
import { lockActiveUser } from '../../users/repository/users.repository.js';

export class UploadsService {
  constructor(
    private readonly client: S3Client = s3Client,
    private readonly transaction: typeof prisma.$transaction = prisma.$transaction.bind(prisma),
  ) {}

  async generatePresignedUploadUrl(userId: string, dto: GetPresignedUrlDto): Promise<PresignedUrlResult> {
    const fileExtension = dto.fileName.split('.').pop() || 'jpg';
    const folder = dto.folder || 'documents';
    const uniqueKey = `${folder}/${userId}/${crypto.randomUUID()}.${fileExtension}`;
    const expiresIn = 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    const bucket = env.AWS_S3_BUCKET;

    const { uploadUrl, fileUrl } = await this.transaction(async (tx) => {
      await lockActiveUser(tx, userId);
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: uniqueKey,
        ContentType: dto.fileType,
      });
      const signedUrl = await getSignedUrl(this.client, command, { expiresIn });
      const publicUrl = this._fileUrl(uniqueKey);
      await tx.uploadGrant.create({
        data: { userId, bucket, objectKey: uniqueKey, expiresAt },
      });
      return { uploadUrl: signedUrl, fileUrl: publicUrl };
    });

    return { uploadUrl, fileUrl, key: uniqueKey, expiresIn };
  }

  fileUrlForKey(objectKey: string): string {
    if (env.AWS_ENDPOINT && env.AWS_ENDPOINT.includes('backblazeb2.com')) {
      return `https://s3.${env.AWS_REGION}.backblazeb2.com/${env.AWS_S3_BUCKET}/${objectKey}`;
    }
    if (env.AWS_ENDPOINT && env.AWS_ENDPOINT.trim() !== '') {
      const endpoint = new URL(env.AWS_ENDPOINT.trim());
      return `${endpoint.protocol}//${endpoint.host}/${env.AWS_S3_BUCKET}/${objectKey}`;
    }
    return `https://s3.${env.AWS_REGION}.amazonaws.com/${env.AWS_S3_BUCKET}/${objectKey}`;
  }

  async deleteOwnedObject(object: OwnedObjectKey): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: object.bucket, Key: object.objectKey }),
    );
  }

  async deleteFileByUrl(fileUrl: string, userId: string): Promise<OwnedObjectKey> {
    const object = getOwnedObjectKey(fileUrl, userId);
    if (!object) throw new Error('File URL is not a generated object owned by this user.');
    await this.deleteOwnedObject(object);
    return object;
  }

  private _fileUrl(objectKey: string): string {
    return this.fileUrlForKey(objectKey);
  }
}
