import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'mysql://root:password@127.0.0.1:3306/scanpro_test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-chars';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-chars';
process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.AWS_S3_BUCKET = 'scanpro-test-bucket';

const { UsersService } = await import('../src/modules/users/service/users.service.js');
const { DocumentsService } = await import('../src/modules/documents/service/documents.service.js');
const { DeletionWorkerService } = await import('../src/modules/documents/service/deletion-worker.service.js');

test('UploadsService.deleteFileByUrl throws error when URL is invalid or unowned', async () => {
  const { UploadsService } = await import('../src/modules/uploads/service/uploads.service.js');
  const service = new UploadsService();

  // Test invalid URL format throws error
  await assert.rejects(
    async () => {
      await service.deleteFileByUrl('invalid-url-without-slash', 'test-user-123');
    },
    {
      message: /File URL is not a generated object owned by this user/,
    }
  );
});

test('UsersService.deleteAccount requests account deletion for active user', async () => {
  const userId = 'test-user-123';
  let requested = false;

  const mockUsersRepo = {
    findById: async (id: string) => ({
      id,
      name: 'Test',
      email: 'test@example.com',
      passwordHash: 'hash',
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    requestAccountDeletion: async (id: string) => {
      assert.equal(id, userId);
      requested = true;
    },
  } as any;

  const usersService = new UsersService(
    mockUsersRepo,
    {} as any,
  );

  await usersService.deleteAccount(userId);
  assert.equal(requested, true);
});

test('DocumentsService.retryPendingDeletions updates status to FAILED on error and does not falsely mark COMPLETED', async () => {
  const records = [
    {
      id: 'rec-1',
      bucket: 'test-bucket',
      objectKey: 'users/user-1/fail.pdf',
      fileUrl: 'https://b2.scanpro.com/fail.pdf',
      documentId: 'doc-1',
      userId: 'user-1',
      attempts: 0,
      lastError: null,
      status: 'PENDING',
      leaseToken: 'lease-token-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'rec-2',
      bucket: 'test-bucket',
      objectKey: 'users/user-1/success.pdf',
      fileUrl: 'https://b2.scanpro.com/success.pdf',
      documentId: 'doc-2',
      userId: 'user-1',
      attempts: 0,
      lastError: null,
      status: 'PENDING',
      leaseToken: 'lease-token-2',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const failedStatus: Record<string, { status: string; error: string }> = {};
  const completedStatus: string[] = [];

  const mockPendingRepo = {
    claimBatch: async () => records,
    markCompleted: async (id: string, token: string) => {
      assert.ok(token);
      completedStatus.push(id);
      return true;
    },
    markFailed: async (id: string, token: string, error: string) => {
      assert.ok(token);
      failedStatus[id] = { status: 'FAILED', error };
      return 'FAILED';
    },
  } as any;

  const mockUploads = {
    deleteOwnedObject: async (object: { bucket: string; objectKey: string }) => {
      if (object.objectKey.includes('fail')) {
        throw new Error('B2 Connection Timed Out');
      }
    },
  } as any;

  const documentsService = new DocumentsService(
    {} as any,
    mockUploads,
    {} as any,
    mockPendingRepo
  );

  const result = await documentsService.retryPendingDeletions(10);

  assert.equal(result.processed, 2);
  assert.equal(result.succeeded, 1);
  assert.equal(result.failed, 1);

  assert.ok(completedStatus.includes('rec-2'));
  assert.ok(!completedStatus.includes('rec-1'), 'Failed deletion must never be marked COMPLETED');
  assert.equal(failedStatus['rec-1']?.status, 'FAILED');
  assert.equal(failedStatus['rec-1']?.error, 'B2 Connection Timed Out');
});

test('DeletionWorkerService starts and stops cleanly without dangling timer', () => {
  const mockDocumentsService = {
    retryPendingDeletions: async () => ({ processed: 0, succeeded: 0, failed: 0 }),
  } as any;

  const worker = new DeletionWorkerService(mockDocumentsService, 1000);
  worker.start();
  // Double-start is safe
  worker.start();
  worker.stop();
  // Double-stop is safe
  worker.stop();
});
