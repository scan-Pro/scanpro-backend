import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'mysql://test:test@127.0.0.1:3306/scaniro_test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-chars';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-chars';
process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.AWS_REGION = 'us-east-005';
process.env.AWS_S3_BUCKET = 'scaniro-app';
process.env.AWS_ENDPOINT = 'https://s3.us-east-005.backblazeb2.com';

const { UploadsService, makeObjectIdentity } = await import(
  '../src/modules/uploads/service/uploads.service.js'
);

test('resolves a B2 object URL only for its configured bucket and exact owner path segment', () => {
  const service = new UploadsService();
  const ownerId = 'owner-123';
  const url = `https://s3.us-east-005.backblazeb2.com/scaniro-app/documents/${ownerId}/0f6bc744-9e56-4c5c-b31e-1e318ba9dada.pdf`;

  assert.deepEqual(service.resolveOwnedStorageUrl(url, ownerId), {
    fileUrl: url,
    bucket: 'scaniro-app',
    objectKey: `documents/${ownerId}/0f6bc744-9e56-4c5c-b31e-1e318ba9dada.pdf`,
    objectIdentity: makeObjectIdentity(
      'scaniro-app',
      `documents/${ownerId}/0f6bc744-9e56-4c5c-b31e-1e318ba9dada.pdf`
    ),
  });
});

test('rejects another owner, an unknown host, and malformed storage paths', () => {
  const service = new UploadsService();
  const ownerId = 'owner-123';

  assert.equal(
    service.resolveOwnedStorageUrl(
      'https://s3.us-east-005.backblazeb2.com/scaniro-app/documents/owner-other/file.pdf',
      ownerId
    ).objectKey,
    null
  );
  assert.equal(
    service.resolveOwnedStorageUrl(
      'https://attacker.example/scaniro-app/documents/owner-123/file.pdf',
      ownerId
    ).objectKey,
    null
  );
  assert.equal(
    service.resolveOwnedStorageUrl(
      'https://s3.us-east-005.backblazeb2.com/scaniro-app/documents/owner-123/../other/file.pdf',
      ownerId
    ).objectKey,
    null
  );
});

test('object identity is stable and sensitive to bucket/key changes', () => {
  const a = makeObjectIdentity('scaniro-app', 'documents/owner-123/a.pdf');
  assert.equal(a, makeObjectIdentity('scaniro-app', 'documents/owner-123/a.pdf'));
  assert.notEqual(a, makeObjectIdentity('other-bucket', 'documents/owner-123/a.pdf'));
  assert.notEqual(a, makeObjectIdentity('scaniro-app', 'documents/owner-123/b.pdf'));
});
