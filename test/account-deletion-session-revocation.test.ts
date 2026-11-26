import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'mysql://test:test@127.0.0.1:3306/scaniro_test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-that-is-at-least-32-chars';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-that-is-at-least-32-chars';
process.env.AWS_ACCESS_KEY_ID ??= 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY ??= 'test-secret-key';

const { AccountDeletionService } = await import(
  '../src/modules/users/service/account-deletion.service.js'
);
const { AuthService } = await import('../src/modules/auth/service/auth.service.js');
const { hashRefreshToken, signScaniroToken } = await import(
  '../src/common/utils/jwt.util.js'
);
const { env } = await import('../src/config/env.js');

function createInMemoryDeletionDb(userId: string) {
  let lifecycleStatus: 'ACTIVE' | 'DELETING' = 'ACTIVE';
  let existingJob: { id: string; status: string } | null = null;
  let refreshTokens = [
    { id: 'rt-1', userId, tokenHash: 'hash-1' },
    { id: 'rt-2', userId, tokenHash: 'hash-2' },
    { id: 'rt-other', userId: 'other-user', tokenHash: 'hash-other' },
  ];
  const txOperations: string[] = [];

  const db = {
    accountDeletionReceipt: {
      findUnique: async () => null,
    },
    accountDeletionJob: {
      findUnique: async () => existingJob,
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      const tx = {
        $queryRaw: async () => [{ id: userId, lifecycle_status: lifecycleStatus }],
        accountDeletionJob: {
          findUnique: async () => existingJob,
          create: async ({ data }: { data: { userId: string; status: string } }) => {
            txOperations.push('job.create');
            existingJob = { id: 'del-job-1', status: data.status };
            return existingJob;
          },
          update: async ({ data }: { data: { status: string } }) => {
            txOperations.push('job.update');
            existingJob = { id: existingJob!.id, status: data.status };
            return existingJob;
          },
        },
        document: {
          findMany: async () => [],
        },
        uploadGrant: {
          findMany: async () => [],
        },
        user: {
          update: async ({
            data,
          }: {
            where: { id: string };
            data: { lifecycleStatus: 'ACTIVE' | 'DELETING' };
          }) => {
            txOperations.push(`user.update:${data.lifecycleStatus}`);
            lifecycleStatus = data.lifecycleStatus;
            return { id: userId, lifecycleStatus };
          },
        },
        refreshToken: {
          deleteMany: async ({ where }: { where: { userId: string } }) => {
            txOperations.push(`refreshToken.deleteMany:${where.userId}`);
            const before = refreshTokens.length;
            refreshTokens = refreshTokens.filter((token) => token.userId !== where.userId);
            return { count: before - refreshTokens.length };
          },
        },
        documentTombstone: {
          createMany: async () => ({ count: 0 }),
        },
        pendingDeletion: {
          findFirst: async () => null,
          create: async () => ({}),
        },
      };

      return fn(tx);
    },
  };

  return {
    db: db as unknown as ConstructorParameters<typeof AccountDeletionService>[1],
    getLifecycleStatus: () => lifecycleStatus,
    getRefreshTokens: () => refreshTokens,
    getTxOperations: () => txOperations,
    injectStrayRefreshToken: (id: string, tokenHash: string) => {
      refreshTokens.push({ id, userId, tokenHash });
    },
  };
}

test('requestDeletion revokes all user refresh tokens atomically when transitioning to DELETING', async () => {
  const userId = 'user-delete-revoke';
  const harness = createInMemoryDeletionDb(userId);
  const service = new AccountDeletionService(undefined, harness.db);

  const result = await service.requestDeletion(userId);
  assert.deepEqual(result, { status: 'DELETING', jobId: 'del-job-1' });
  assert.equal(harness.getLifecycleStatus(), 'DELETING');
  assert.deepEqual(
    harness.getRefreshTokens().map((token) => token.userId),
    ['other-user'],
  );
  assert.ok(harness.getTxOperations().includes('user.update:DELETING'));
  assert.ok(harness.getTxOperations().includes(`refreshToken.deleteMany:${userId}`));
});

test('idempotent repeat requestDeletion clears any remaining refresh tokens for DELETING user', async () => {
  const userId = 'user-delete-repeat';
  const harness = createInMemoryDeletionDb(userId);
  const service = new AccountDeletionService(undefined, harness.db);

  await service.requestDeletion(userId);
  harness.injectStrayRefreshToken('rt-stray', 'hash-stray');
  assert.equal(
    harness.getRefreshTokens().filter((token) => token.userId === userId).length,
    1,
  );

  const repeated = await service.requestDeletion(userId);
  assert.deepEqual(repeated, { status: 'DELETING', jobId: 'del-job-1' });
  assert.equal(
    harness.getRefreshTokens().filter((token) => token.userId === userId).length,
    0,
  );
});

test('AuthService.refreshTokens rejects revoked session after deletion transition', async () => {
  const userId = 'user-refresh-revoked';
  const email = 'deleting@example.com';
  const refreshJwt = signScaniroToken(
    userId,
    email,
    'refresh',
    env.JWT_REFRESH_SECRET,
    '90d',
  );
  const activeSessions = new Map<
    string,
    {
      id: string;
      userId: string;
      tokenHash: string;
      expiresAt: Date;
      user: {
        id: string;
        name: string;
        email: string;
        passwordHash: string;
        createdAt: Date;
        lifecycleStatus: 'ACTIVE' | 'DELETING';
      };
    }
  >();

  activeSessions.set(hashRefreshToken(refreshJwt), {
    id: 'rt-live',
    userId,
    tokenHash: hashRefreshToken(refreshJwt),
    expiresAt: new Date(Date.now() + 60_000),
    user: {
      id: userId,
      name: 'Test User',
      email,
      passwordHash: 'hash',
      createdAt: new Date(),
      lifecycleStatus: 'ACTIVE',
    },
  });

  // Simulate immediate deletion revocation removing all user refresh tokens.
  for (const [key, session] of activeSessions) {
    if (session.userId === userId) activeSessions.delete(key);
  }

  const authService = new AuthService({
    findUserByEmail: async () => null,
    createUser: async () => {
      throw new Error('unused');
    },
    saveRefreshToken: async () => undefined,
    findRefreshToken: async (tokenHash) => activeSessions.get(tokenHash) ?? null,
    findLegacyRefreshToken: async () => null,
    deleteRefreshToken: async () => undefined,
    deleteExpiredRefreshToken: async () => undefined,
    rotateRefreshToken: async () => undefined,
    deleteAllUserRefreshTokens: async () => undefined,
  });

  await assert.rejects(
    authService.refreshTokens({ refreshToken: refreshJwt }),
    /Invalid refresh token/i,
  );
});
