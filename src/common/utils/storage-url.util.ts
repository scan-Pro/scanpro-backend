import { createHash } from 'node:crypto';
import { env } from '../../config/env.js';
import { ForbiddenError } from '../errors/app-error.js';

export interface OwnedObjectKey {
  bucket: string;
  objectKey: string;
}

export function getOwnedObjectKey(url: string, userId: string): OwnedObjectKey | null {
  try {
    const parsed = new URL(url);
    const configuredEndpoint = env.AWS_ENDPOINT.trim();
    const expectedHost = configuredEndpoint
      ? new URL(configuredEndpoint).host
      : `s3.${env.AWS_REGION}.amazonaws.com`;
    if (parsed.protocol !== 'https:' || parsed.host !== expectedHost) return null;

    const parts = parsed.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (parts[0] !== env.AWS_S3_BUCKET || parts.length < 3) return null;
    const objectKey = parts.slice(1).join('/');
    const keyParts = objectKey.split('/');
    const fileName = keyParts.at(-1) ?? '';
    if (
      keyParts.some((part) => part === '.' || part === '..') ||
      keyParts.at(-2) !== userId ||
      !/^[0-9a-f]{8}-[0-9a-f-]{27}\.[a-zA-Z0-9]{1,12}$/.test(fileName)
    ) {
      return null;
    }
    return { bucket: env.AWS_S3_BUCKET, objectKey };
  } catch {
    return null;
  }
}

export function getObjectDedupeKey(bucket: string, objectKey: string): string {
  return createHash('sha256').update(`${bucket}\0${objectKey}`).digest('hex');
}

export function assertOwnStorageUrl(url: string | null | undefined, userId: string, fieldName: string): void {
  if (!url) return;
  if (!getOwnedObjectKey(url, userId)) {
    throw new ForbiddenError(`${fieldName} does not belong to the current user's configured storage bucket`, 'INVALID_FILE_URL');
  }
}
