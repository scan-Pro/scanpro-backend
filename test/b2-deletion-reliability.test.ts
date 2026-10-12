import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'mysql://root:password@127.0.0.1:3306/scanpro_test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-chars';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-chars';
process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.AWS_S3_BUCKET = 'scanpro-test-bucket';

import { UsersService } from '../src/modules/users/service/users.service.js';
import { DocumentsService } from '../src/modules/documents/service/documents.service.js';
import { DeletionWorkerService } from '../src/modules/documents/service/deletion-worker.service.js';
import { PendingDeletionRecord } from '../src/modules/documents/repository/pending-deletion.repository.js';
import { prisma } from '../src/config/database.js';

test('UploadsService.deleteFileByUrl throws error when S3 delete fails', async () => {
  const { UploadsService } = await import('../src/modules/uploads/service/uploads.service.js');
  const service = new UploadsService();

  // Test invalid URL format throws error
  await assert.rejects(
    async () => {
      await service.deleteFileByUrl('invalid-url-without-slash');
    },
    {
      message: /Cannot extract key from file URL/,
    }
  );
});

test('UsersService.deleteAccount records all owned cloud URLs before deleting user', async () => {
  const userId = 'test-user-123';
  const createdEntries: any[] = [];
  let userDeleted = false;
  const deletedUrls: string[] = [];

  // Mock Prisma document query
  const originalFindMany = prisma.document.findMany;
  (prisma.document as any).findMany = async (args: any) => {
    assert.equal(args.where.userId, userId);
    return [
      {
        id: 'doc-1',
        userId,
        thumbnailUrl: 'https://b2.scanpro.com/files/doc1-thumb.jpg',
        pdfUrl: 'https://b2.scanpro.com/files/doc1.pdf',
        pages: [
          {
            id: 'page-1',
            imageUrl: 'https://b2.scanpro.com/files/p1.jpg',
            thumbnailUrl: 'https://b2.scanpro.com/files/p1-thumb.jpg',
          },
        ],
      },
      {
        id: 'doc-2',
        userId,
        thumbnailUrl: null,
        pdfUrl: 'https://b2.scanpro.com/files/doc2.pdf',
        pages: [],
      },
    ];
  };

  const mockUsersRepo = {
    findById: async (id: string) => ({ id, name: 'Test', email: 'test@example.com', passwordHash: 'hash', createdAt: new Date(), updatedAt: new Date() }),
    deleteUser: async (id: string) => {
      // Must be called AFTER pending deletions are created
      assert.equal(createdEntries.length, 5, 'Pending deletions must be recorded before deleting user');
      userDeleted = true;
    },
  } as any;

  const mockPendingRepo = {
    createMany: async (entries: any[]) => {
      createdEntries.push(...entries);
    },
    markCompletedByUrl: async (url: string) => {
      deletedUrls.push(url);
    },
    markFailedByUrl: async (_url: string, _err: string) => {},
  } as any;

  const mockUploads = {
    deleteFileByUrl: async (url: string) => {
      return; // Success
    },
  } as any;

  try {
    const usersService = new UsersService(
      mockUsersRepo,
      {} as any,
      mockPendingRepo,
      mockUploads
    );

    await usersService.deleteAccount(userId);

    assert.equal(userDeleted, true);
    assert.equal(createdEntries.length, 5);
    const urls = createdEntries.map((e) => e.fileUrl);
    assert.ok(urls.includes('https://b2.scanpro.com/files/doc1-thumb.jpg'));
    assert.ok(urls.includes('https://b2.scanpro.com/files/doc1.pdf'));
    assert.ok(urls.includes('https://b2.scanpro.com/files/p1.jpg'));
    assert.ok(urls.includes('https://b2.scanpro.com/files/p1-thumb.jpg'));
    assert.ok(urls.includes('https://b2.scanpro.com/files/doc2.pdf'));
  } finally {
    prisma.document.findMany = originalFindMany;
  }
});

test('DocumentsService.retryPendingDeletions updates status to FAILED on error and does not falsely mark COMPLETED', async () => {
  const records: PendingDeletionRecord[] = [
    {
      id: 'rec-1',
      fileUrl: 'https://b2.scanpro.com/fail.pdf',
      documentId: 'doc-1',
      userId: 'user-1',
      attempts: 0,
      lastError: null,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'rec-2',
      fileUrl: 'https://b2.scanpro.com/success.pdf',
      documentId: 'doc-2',
      userId: 'user-1',
      attempts: 0,
      lastError: null,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const failedStatus: Record<string, { status: string; error: string }> = {};
  const completedStatus: string[] = [];

  const mockPendingRepo = {
    findPending: async () => records,
    findFailed: async () => [],
    markRetrying: async () => {},
    markCompleted: async (id: string) => {
      completedStatus.push(id);
    },
    markFailed: async (id: string, error: string) => {
      failedStatus[id] = { status: 'FAILED', error };
    },
  } as any;

  const mockUploads = {
    deleteFileByUrl: async (url: string) => {
      if (url.includes('fail')) {
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
