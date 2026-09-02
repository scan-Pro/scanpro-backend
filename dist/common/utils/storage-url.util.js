import { ForbiddenError } from '../errors/app-error.js';
/**
 * Checks whether a cloud storage URL belongs to the given user.
 *
 * `UploadsService.generatePresignedUploadUrl` always issues keys of the
 * form `{folder}/{userId}/{uuid}.{ext}`, so the resulting `fileUrl` always
 * has the requesting user's id as its own path segment (regardless of
 * whether it's a Backblaze B2 URL, a raw S3-compatible endpoint URL, or the
 * local-dev mock URL). This lets us verify — server-side, at write time —
 * that a URL a client is trying to save onto a document/page was actually
 * issued to that same user, rather than trusting an arbitrary client-
 * supplied string.
 */
export function isOwnStorageUrl(url, userId) {
    try {
        const { pathname } = new URL(url);
        return pathname.split('/').filter(Boolean).includes(userId);
    }
    catch {
        // Not a well-formed absolute URL (e.g. a raw local device file path) —
        // never valid for a field that's supposed to hold a cloud storage URL.
        return false;
    }
}
/**
 * Throws a `ForbiddenError` if `url` is set but doesn't belong to `userId`'s
 * own storage prefix. No-op for null/undefined/empty values, since these
 * fields are optional/nullable.
 */
export function assertOwnStorageUrl(url, userId, fieldName) {
    if (!url)
        return;
    if (!isOwnStorageUrl(url, userId)) {
        throw new ForbiddenError(`${fieldName} does not belong to the current user`, 'INVALID_FILE_URL');
    }
}
//# sourceMappingURL=storage-url.util.js.map