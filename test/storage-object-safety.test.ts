import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { S3Client } from '@aws-sdk/client-s3';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'mysql://ci:ci@127.0.0.1:3306/scaniro_ci';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-chars';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-chars';
process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.AWS_REGION = 'us-east-005';
process.env.AWS_S3_BUCKET = 'scaniro-app';
process.env.AWS_ENDPOINT = 'https://s3.us-east-005.backblazeb2.com';

const { UploadsService } = await import('../src/modules/uploads/service/uploads.service.js');

test('resolves only a configured storage URL for the matching owner', () => {
  const service = new UploadsService({ send: async () => ({}) } as unknown as S3Client);
  assert.deepEqual(
    service.resolveOwnedObjectUrl(
      'https://s3.us-east-005.backblazeb2.com/scaniro-app/pages/user-1/abc123.jpg',
      'user-1',
    ),
    { bucket: 'scaniro-app', key: 'pages/user-1/abc123.jpg' },
  );

  assert.throws(() =>
    service.resolveOwnedObjectUrl(
      'https://s3.us-east-005.backblazeb2.com/scaniro-app/pages/user-2/abc123.jpg',
      'user-1',
    ),
  );
  assert.throws(() =>
    service.resolveOwnedObjectUrl(
      'https://attacker.example/scaniro-app/pages/user-1/abc123.jpg',
      'user-1',
    ),
  );
});

test('rejects non-canonical keys and keys outside supported namespaces', async () => {
  const service = new UploadsService({ send: async () => ({}) } as unknown as S3Client);
  await assert.rejects(service.deleteObject('other-bucket', 'pages/user-1/file.jpg'));
  await assert.rejects(service.deleteObject('scaniro-app', '../user-1/file.jpg'));
  await assert.rejects(service.deleteObject('scaniro-app', 'unknown/user-1/file.jpg'));
  await assert.rejects(service.deleteObject('scaniro-app', 'pages/user-1/nested/file.jpg'));
});

test('deletes only the exact configured bucket and object key', async () => {
  const sent: unknown[] = [];
  const service = new UploadsService({
    send: async (command: unknown) => {
      sent.push(command);
      return {};
    },
  } as unknown as S3Client);

  await service.deleteObject('scaniro-app', 'pages/user-1/abc123.jpg');
  assert.equal(sent.length, 1);
  const command = sent[0] as { input: { Bucket?: string; Key?: string } };
  assert.equal(command.input.Bucket, 'scaniro-app');
  assert.equal(command.input.Key, 'pages/user-1/abc123.jpg');
});

test('propagates object-storage deletion failures for retry processing', async () => {
  const service = new UploadsService({
    send: async () => {
      throw new Error('simulated object storage failure');
    },
  } as unknown as S3Client);

  await assert.rejects(
    service.deleteObject('scaniro-app', 'pages/user-1/abc123.jpg'),
    /simulated object storage failure/,
  );
});
