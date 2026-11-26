import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';

process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'mysql://ci:ci@127.0.0.1:3306/scaniro_ci';
process.env.JWT_ACCESS_SECRET ??= 'ci-access-secret-which-is-at-least-32-chars';
process.env.JWT_REFRESH_SECRET ??= 'ci-refresh-secret-which-is-at-least-32-chars';
process.env.AWS_ACCESS_KEY_ID ??= 'ci-storage-access-key';
process.env.AWS_SECRET_ACCESS_KEY ??= 'ci-storage-secret-key';
process.env.AWS_REGION ??= 'us-east-005';
process.env.AWS_S3_BUCKET ??= 'scaniro-app';
process.env.AWS_ENDPOINT ??= 'https://s3.us-east-005.backblazeb2.com';

const runMysqlIntegration = process.env.RUN_MYSQL_INTEGRATION === '1';
const { prisma } = await import('../src/config/database.js');
const { DocumentsRepository } = await import('../src/modules/documents/repository/documents.repository.js');
const { AccountDeletionService } = await import('../src/modules/users/service/account-deletion.service.js');

const storageUrl = (userId: string, name: string) =>
  `https://s3.us-east-005.backblazeb2.com/scaniro-app/pages/${userId}/${name}`;

async function createUser(userId: string): Promise<void> {
  await prisma.user.create({
    data: {
      id: userId,
      email: `phase1-${userId}@example.invalid`,
      name: 'Phase 1 Integration Test',
      passwordHash: 'not-a-real-password-hash',
    },
  });
}

async function cleanupUser(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.pendingDeletion.deleteMany({ where: { userId } });
    await tx.uploadGrant.deleteMany({ where: { userId } });
    await tx.accountDeletionReceipt.deleteMany({ where: { userId } });
    await tx.accountDeletionJob.deleteMany({ where: { userId } });
    await tx.documentTombstone.deleteMany({ where: { userId } });
    await tx.user.deleteMany({ where: { id: userId } });
  });
}

after(async () => {
  await prisma.$disconnect();
});

test(
  'MySQL: a server tombstone blocks stale document POST and UPDATE',
  { skip: !runMysqlIntegration },
  async () => {
    const userId = randomUUID();
    const documentId = randomUUID();
    const pageId = randomUUID();
    const imageUrl = storageUrl(userId, 'tombstone-fixture.jpg');
    const repository = new DocumentsRepository();

    try {
      await createUser(userId);
      await repository.createDocument(userId, {
        id: documentId,
        title: 'Document to delete',
        pages: [{ id: pageId, pageOrder: 0, imageUrl }],
      });

      await repository.deleteDocument(documentId, userId, (_url, ownerId) => ({
        bucket: 'scaniro-app',
        key: `pages/${ownerId}/tombstone-fixture.jpg`,
      }));

      await assert.rejects(
        repository.createDocument(userId, {
          id: documentId,
          title: 'Stale upload response',
          pages: [{ id: randomUUID(), pageOrder: 0, imageUrl }],
        }),
        /deleted document/i,
      );
      await assert.rejects(
        repository.updateDocument(documentId, userId, { title: 'Stale update' }),
        /deleted document/i,
      );

      assert.equal(await prisma.document.count({ where: { id: documentId, userId } }), 0);
      assert.equal(
        await prisma.documentTombstone.count({ where: { userId, documentId } }),
        1,
      );
      assert.equal(await prisma.pendingDeletion.count({
        where: { userId, documentId, bucket: 'scaniro-app', objectKey: `pages/${userId}/tombstone-fixture.jpg` },
      }), 1);
    } finally {
      await cleanupUser(userId);
    }
  },
);

test(
  'MySQL: account deletion waits for exact-key cleanup and leaves a durable receipt',
  { skip: !runMysqlIntegration },
  async () => {
    const userId = randomUUID();
    const documentId = randomUUID();
    const pageId = randomUUID();
    const key = `pages/${userId}/account-delete-fixture.jpg`;
    const fileUrl = storageUrl(userId, 'account-delete-fixture.jpg');
    const deleted: Array<{ bucket: string; key: string; ownerId: string }> = [];

    const fakeStorage = {
      resolveOwnedObjectUrl: (url: string, ownerId: string) => {
        const parsed = new URL(url);
        const prefix = '/scaniro-app/';
        assert.equal(parsed.origin, 'https://s3.us-east-005.backblazeb2.com');
        assert.ok(parsed.pathname.startsWith(prefix));
        const resolvedKey = decodeURIComponent(parsed.pathname.slice(prefix.length));
        assert.equal(resolvedKey.split('/')[1], ownerId);
        return { bucket: 'scaniro-app', key: resolvedKey };
      },
      deleteObject: async (bucket: string, objectKey: string, ownerId: string) => {
        deleted.push({ bucket, key: objectKey, ownerId });
      },
    };

    const service = new AccountDeletionService(
      fakeStorage as unknown as ConstructorParameters<typeof AccountDeletionService>[0],
    );

    try {
      await createUser(userId);
      await prisma.refreshToken.create({
        data: {
          userId,
          tokenHash: `hash-${randomUUID()}`,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      await prisma.document.create({
        data: {
          id: documentId,
          userId,
          title: 'Account deletion fixture',
          pageCount: 1,
          pages: {
            create: {
              id: pageId,
              pageOrder: 0,
              imageUrl: fileUrl,
              filter: 'ORIGINAL',
              rotation: 0,
            },
          },
        },
      });
      await prisma.uploadGrant.create({
        data: {
          userId,
          bucket: 'scaniro-app',
          objectKey: key,
          fileUrl,
          // Simulate an already-expired grant so this disposable test does not
          // need to wait for a real upload URL to expire.
          expiresAt: new Date(Date.now() - 10 * 60 * 1000),
          cleanupDone: false,
        },
      });

      const firstRequest = await service.requestDeletion(userId);
      assert.equal(firstRequest.status, 'DELETING');
      assert.ok(firstRequest.jobId);

      const repeatedRequest = await service.requestDeletion(userId);
      assert.equal(repeatedRequest.status, 'DELETING');
      assert.equal(repeatedRequest.jobId, firstRequest.jobId);

      const deletingUser = await prisma.user.findUnique({ where: { id: userId } });
      assert.equal(deletingUser?.lifecycleStatus, 'DELETING');
      assert.equal(await prisma.refreshToken.count({ where: { userId } }), 0);
      assert.equal(await prisma.document.count({ where: { id: documentId, userId } }), 1);

      const cleanupBatch = await service.processPendingDeletionBatch(10);
      assert.equal(cleanupBatch.claimed, 1);
      assert.equal(cleanupBatch.succeeded, 1);
      assert.deepEqual(deleted, [{ bucket: 'scaniro-app', key, ownerId: userId }]);

      await prisma.accountDeletionJob.update({
        where: { userId },
        data: { updatedAt: new Date(Date.now() - 20 * 1000) },
      });
      const finalization = await service.processAccountDeletionBatch(10);
      assert.equal(finalization.claimed, 1);
      assert.equal(finalization.finalized, 1);

      assert.equal(await prisma.user.count({ where: { id: userId } }), 0);
      const receipt = await prisma.accountDeletionReceipt.findUnique({ where: { userId } });
      assert.ok(receipt);
      const completedJob = await prisma.accountDeletionJob.findUnique({ where: { userId } });
      assert.equal(completedJob?.status, 'COMPLETED');
    } finally {
      await cleanupUser(userId);
    }
  },
);
