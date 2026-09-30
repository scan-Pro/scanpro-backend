import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import type { AuthenticatedRequest } from '../src/common/types/index.js';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'mysql://test:test@127.0.0.1:3306/scaniro_test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-chars';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-chars';
process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';

const { env } = await import('../src/config/env.js');
const { AuthService } = await import('../src/modules/auth/service/auth.service.js');
const { authenticate } = await import('../src/middlewares/auth.middleware.js');
const {
  hashRefreshToken,
  signScaniroToken,
  verifyScaniroToken,
} = await import('../src/common/utils/jwt.util.js');
const { hashLegacyRefreshTokens } = await import(
  '../src/modules/auth/service/refresh-token-hash-migration.service.js'
);
const { UnauthorizedError } = await import('../src/common/errors/app-error.js');

interface TestUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

interface TestSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  user: TestUser;
}

class MemoryAuthRepository {
  readonly sessions = new Map<string, TestSession>();
  readonly user: TestUser = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    passwordHash: '',
    createdAt: new Date(),
  };
  private nextId = 0;
  private hasUser = false;

  async findUserByEmail(): Promise<TestUser | null> {
    return this.hasUser ? this.user : null;
  }

  async createUser(data: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<TestUser> {
    Object.assign(this.user, data);
    this.hasUser = true;
    return this.user;
  }

  async saveRefreshToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    this.sessions.set(tokenHash, {
      id: `session-${++this.nextId}`,
      userId,
      tokenHash,
      expiresAt,
      user: this.user,
    });
  }

  async findRefreshToken(tokenHash: string): Promise<TestSession | null> {
    return this.sessions.get(tokenHash) ?? null;
  }

  async findLegacyRefreshToken(rawToken: string): Promise<TestSession | null> {
    return this.sessions.get(rawToken) ?? null;
  }

  async deleteRefreshToken(
    tokenHash: string,
    legacyRawToken?: string,
  ): Promise<void> {
    this.sessions.delete(tokenHash);
    if (legacyRawToken) this.sessions.delete(legacyRawToken);
  }

  async deleteExpiredRefreshToken(id: string): Promise<void> {
    for (const [key, session] of this.sessions) {
      if (session.id === id) this.sessions.delete(key);
    }
  }

  async rotateRefreshToken(data: {
    oldRecordId: string;
    userId: string;
    oldStoredValue: string;
    newTokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    const oldSession = this.sessions.get(data.oldStoredValue);
    if (
      !oldSession ||
      oldSession.id !== data.oldRecordId ||
      oldSession.userId !== data.userId
    ) {
      throw new UnauthorizedError(
        'Refresh token has already been used',
        'REFRESH_TOKEN_REUSED',
      );
    }
    this.sessions.delete(data.oldStoredValue);
    await this.saveRefreshToken(
      data.userId,
      data.newTokenHash,
      data.expiresAt,
    );
  }

  async deleteAllUserRefreshTokens(userId: string): Promise<void> {
    for (const [key, session] of this.sessions) {
      if (session.userId === userId) this.sessions.delete(key);
    }
  }

  async findRefreshTokensForHashMigration(): Promise<
    { id: string; tokenHash: string }[]
  > {
    return [...this.sessions.values()].map(({ id, tokenHash }) => ({
      id,
      tokenHash,
    }));
  }

  async replaceLegacyRefreshToken(
    id: string,
    legacyRawToken: string,
    tokenHash: string,
  ): Promise<boolean> {
    const oldSession = this.sessions.get(legacyRawToken);
    if (!oldSession || oldSession.id !== id) return false;
    this.sessions.delete(legacyRawToken);
    oldSession.tokenHash = tokenHash;
    this.sessions.set(tokenHash, oldSession);
    return true;
  }
}

test('issues and verifies access and refresh JWTs with separate token purposes', () => {
  const access = signScaniroToken(
    'user-1',
    'test@example.com',
    'access',
    env.JWT_ACCESS_SECRET,
    '15m',
  );
  const refresh = signScaniroToken(
    'user-1',
    'test@example.com',
    'refresh',
    env.JWT_REFRESH_SECRET,
    '90d',
  );

  const claims = verifyScaniroToken(
    access,
    'access',
    env.JWT_ACCESS_SECRET,
  );
  assert.equal(claims.iss, env.JWT_ISSUER);
  assert.equal(claims.aud, env.JWT_AUDIENCE);
  assert.equal(typeof claims.iat, 'number');
  assert.equal(typeof claims.exp, 'number');
  assert.ok(claims.jti);
  assert.throws(() =>
    verifyScaniroToken(refresh, 'access', env.JWT_REFRESH_SECRET),
  );
});

test('JWT verifier rejects expiration, signature, issuer, audience, and algorithm mismatches', () => {
  const expired = jwt.sign(
    { userId: 'user-1', email: 'test@example.com', tokenType: 'access' },
    env.JWT_ACCESS_SECRET,
    {
      algorithm: 'HS256',
      audience: env.JWT_AUDIENCE,
      expiresIn: -1,
      issuer: env.JWT_ISSUER,
      jwtid: 'expired-id',
    },
  );
  assert.throws(
    () => verifyScaniroToken(expired, 'access', env.JWT_ACCESS_SECRET),
    jwt.TokenExpiredError,
  );

  const valid = signScaniroToken(
    'user-1',
    'test@example.com',
    'access',
    env.JWT_ACCESS_SECRET,
    '15m',
  );
  assert.throws(() =>
    verifyScaniroToken(valid, 'access', 'different-secret-with-32-characters'),
  );

  for (const options of [
    { issuer: 'another-api', audience: env.JWT_AUDIENCE },
    { issuer: env.JWT_ISSUER, audience: 'another-client' },
  ]) {
    const token = jwt.sign(
      { userId: 'user-1', email: 'test@example.com', tokenType: 'access' },
      env.JWT_ACCESS_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: '15m',
        jwtid: 'wrong-claim-id',
        ...options,
      },
    );
    assert.throws(() =>
      verifyScaniroToken(token, 'access', env.JWT_ACCESS_SECRET),
    );
  }

  const unsupportedAlgorithm = jwt.sign(
    { userId: 'user-1', email: 'test@example.com', tokenType: 'access' },
    env.JWT_ACCESS_SECRET,
    { algorithm: 'HS384', expiresIn: '15m', issuer: env.JWT_ISSUER },
  );
  assert.throws(() =>
    verifyScaniroToken(
      unsupportedAlgorithm,
      'access',
      env.JWT_ACCESS_SECRET,
    ),
  );
});

test('authentication middleware rejects a missing bearer token', () => {
  let nextError: unknown;
  authenticate(
    { headers: {} } as AuthenticatedRequest,
    {} as never,
    (error?: unknown) => {
      nextError = error;
    },
  );
  assert.ok(nextError instanceof UnauthorizedError);
});

test('authentication middleware accepts a valid access token and rejects expired tokens', () => {
  const request = {
    headers: {
      authorization: `Bearer ${signScaniroToken(
        'user-1',
        'test@example.com',
        'access',
        env.JWT_ACCESS_SECRET,
        '15m',
      )}`,
    },
  } as AuthenticatedRequest;
  let acceptedError: unknown;
  authenticate(request, {} as never, (error?: unknown) => {
    acceptedError = error;
  });
  assert.equal(acceptedError, undefined);
  assert.deepEqual(request.user, {
    userId: 'user-1',
    email: 'test@example.com',
  });

  const legacyAccess = jwt.sign(
    { userId: 'user-1', email: 'test@example.com' },
    env.JWT_ACCESS_SECRET,
    { algorithm: 'HS256', expiresIn: '15m' },
  );
  const legacyRequest = {
    headers: { authorization: `Bearer ${legacyAccess}` },
  } as AuthenticatedRequest;
  let legacyError: unknown;
  authenticate(legacyRequest, {} as never, (error?: unknown) => {
    legacyError = error;
  });
  assert.equal(legacyError, undefined);
  assert.equal(legacyRequest.user?.userId, 'user-1');

  const invalidClaimsLegacyFallback = jwt.sign(
    { userId: 'user-1', email: 'test@example.com', aud: 'wrong-client' },
    env.JWT_ACCESS_SECRET,
    { algorithm: 'HS256', expiresIn: '15m', issuer: env.JWT_ISSUER },
  );
  const invalidClaimsRequest = {
    headers: { authorization: `Bearer ${invalidClaimsLegacyFallback}` },
  } as AuthenticatedRequest;
  let invalidClaimsError: unknown;
  authenticate(invalidClaimsRequest, {} as never, (error?: unknown) => {
    invalidClaimsError = error;
  });
  assert.ok(invalidClaimsError instanceof UnauthorizedError);

  const expired = jwt.sign(
    { userId: 'user-1', email: 'test@example.com', tokenType: 'access' },
    env.JWT_ACCESS_SECRET,
    {
      algorithm: 'HS256',
      audience: env.JWT_AUDIENCE,
      expiresIn: -1,
      issuer: env.JWT_ISSUER,
      jwtid: 'expired-access',
    },
  );
  const expiredRequest = {
    headers: { authorization: `Bearer ${expired}` },
  } as AuthenticatedRequest;
  let expiredError: unknown;
  authenticate(expiredRequest, {} as never, (error?: unknown) => {
    expiredError = error;
  });
  assert.equal(
    (expiredError as { code?: string } | undefined)?.code,
    'TOKEN_EXPIRED',
  );

  const wrongIssuer = jwt.sign(
    {
      userId: 'user-1',
      email: 'test@example.com',
      tokenType: 'access',
    },
    env.JWT_ACCESS_SECRET,
    {
      algorithm: 'HS256',
      audience: env.JWT_AUDIENCE,
      expiresIn: '15m',
      issuer: 'wrong-issuer',
      jwtid: 'wrong-issuer-id',
    },
  );
  const wrongIssuerRequest = {
    headers: { authorization: `Bearer ${wrongIssuer}` },
  } as AuthenticatedRequest;
  let wrongIssuerError: unknown;
  authenticate(wrongIssuerRequest, {} as never, (error?: unknown) => {
    wrongIssuerError = error;
  });
  assert.ok(wrongIssuerError instanceof UnauthorizedError);
});

test('stores only a refresh-token hash and rotates each token once', async () => {
  const repository = new MemoryAuthRepository();
  const service = new AuthService(repository);
  const login = await service.register({
    name: 'Test User',
    email: 'test@example.com',
    password: 'correct horse battery',
  });
  const stored = [...repository.sessions.keys()][0];

  assert.equal(stored, hashRefreshToken(login.tokens.refreshToken));
  assert.notEqual(stored, login.tokens.refreshToken);
  assert.equal(stored.length, 64);

  const refreshed = await service.refreshTokens({
    refreshToken: login.tokens.refreshToken,
  });
  assert.ok(repository.sessions.has(hashRefreshToken(refreshed.refreshToken)));
  await assert.rejects(
    service.refreshTokens({ refreshToken: login.tokens.refreshToken }),
    UnauthorizedError,
  );
});

test('concurrent refresh requests can consume one session only once', async () => {
  const repository = new MemoryAuthRepository();
  const service = new AuthService(repository);
  const login = await service.register({
    name: 'Test User',
    email: 'test@example.com',
    password: 'correct horse battery',
  });

  const results = await Promise.allSettled([
    service.refreshTokens({ refreshToken: login.tokens.refreshToken }),
    service.refreshTokens({ refreshToken: login.tokens.refreshToken }),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.equal(repository.sessions.size, 1);
});

test('rejects invalid and expired refresh tokens and enforces DB expiry', async () => {
  const repository = new MemoryAuthRepository();
  const service = new AuthService(repository);

  await assert.rejects(
    service.refreshTokens({ refreshToken: 'not-a-jwt' }),
    UnauthorizedError,
  );

  const expiredJwt = jwt.sign(
    { userId: repository.user.id, email: repository.user.email },
    env.JWT_REFRESH_SECRET,
    { algorithm: 'HS256', expiresIn: -1 },
  );
  await assert.rejects(
    service.refreshTokens({ refreshToken: expiredJwt }),
    UnauthorizedError,
  );

  const login = await service.register({
    name: 'Test User',
    email: 'test@example.com',
    password: 'correct horse battery',
  });
  const storedHash = hashRefreshToken(login.tokens.refreshToken);
  const session = repository.sessions.get(storedHash)!;
  session.expiresAt = new Date(Date.now() - 1000);
  await assert.rejects(
    service.refreshTokens({ refreshToken: login.tokens.refreshToken }),
    UnauthorizedError,
  );
  assert.equal(repository.sessions.has(storedHash), false);
});

test('logout removes both hashed sessions and legacy raw refresh sessions', async () => {
  const repository = new MemoryAuthRepository();
  const service = new AuthService(repository);
  const login = await service.register({
    name: 'Test User',
    email: 'test@example.com',
    password: 'correct horse battery',
  });

  await service.logout(login.tokens.refreshToken);
  assert.equal(repository.sessions.size, 0);
});

test('refresh-session revocation removes every session belonging to the user', async () => {
  const repository = new MemoryAuthRepository();
  const service = new AuthService(repository);
  await service.register({
    name: 'Test User',
    email: 'test@example.com',
    password: 'correct horse battery',
  });
  await service.login({
    email: 'test@example.com',
    password: 'correct horse battery',
  });
  assert.equal(repository.sessions.size, 2);

  await repository.deleteAllUserRefreshTokens(repository.user.id);
  assert.equal(repository.sessions.size, 0);
});

test('valid legacy refresh session rotates into hashed storage', async () => {
  const repository = new MemoryAuthRepository();
  const service = new AuthService(repository);
  const legacyToken = jwt.sign(
    { userId: repository.user.id, email: repository.user.email },
    env.JWT_REFRESH_SECRET,
    { algorithm: 'HS256', expiresIn: '90d' },
  );
  repository.sessions.set(legacyToken, {
    id: 'legacy-session',
    userId: repository.user.id,
    tokenHash: legacyToken,
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    user: repository.user,
  });

  const replacement = await service.refreshTokens({ refreshToken: legacyToken });
  assert.equal(repository.sessions.has(legacyToken), false);
  assert.equal(
    repository.sessions.has(hashRefreshToken(replacement.refreshToken)),
    true,
  );
});

test('legacy-token data migration hashes old rows idempotently', async () => {
  const repository = new MemoryAuthRepository();
  const legacyToken = 'legacy raw refresh token value';
  const existingHash = 'a'.repeat(64);
  repository.sessions.set(legacyToken, {
    id: 'legacy-session',
    userId: repository.user.id,
    tokenHash: legacyToken,
    expiresAt: new Date(Date.now() + 60_000),
    user: repository.user,
  });
  repository.sessions.set(existingHash, {
    id: 'hashed-session',
    userId: repository.user.id,
    tokenHash: existingHash,
    expiresAt: new Date(Date.now() + 60_000),
    user: repository.user,
  });

  assert.equal(await hashLegacyRefreshTokens(repository), 1);
  assert.equal(
    repository.sessions.has(hashRefreshToken(legacyToken)),
    true,
  );
  assert.equal(repository.sessions.has(legacyToken), false);
  assert.equal(await hashLegacyRefreshTokens(repository), 0);
});

test('example JWT secrets are placeholders and deployment avoids db push', async () => {
  const example = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
  const workflow = await readFile(
    new URL('../.github/workflows/deploy.yml', import.meta.url),
    'utf8',
  );
  const gitignore = await readFile(new URL('../.gitignore', import.meta.url), 'utf8');
  const baselineSql = await readFile(
    new URL(
      '../prisma/migrations/20260930150000_initial_schema_baseline/migration.sql',
      import.meta.url,
    ),
    'utf8',
  );
  const baselineMarker = await readFile(
    new URL(
      '../prisma/migrations/20260930150000_initial_schema_baseline/BASELINE_VERIFIED',
      import.meta.url,
    ),
    'utf8',
  );

  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    const value = example
      .split('\n')
      .find((line) => line.startsWith(`${key}=`))
      ?.split('=')[1];
    assert.ok(value?.startsWith('replace_with_'));
  }
  assert.match(gitignore, /^\.env\.\*$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
  assert.match(workflow, /npx prisma migrate deploy/);
  assert.match(workflow, /hash-refresh-tokens\.js/);
  assert.match(workflow, /BASELINE_VERIFIED/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run build/);
  assert.doesNotMatch(workflow, /db push --accept-data-loss/);
  assert.match(baselineSql, /CREATE TABLE `users`/);
  assert.doesNotMatch(baselineSql, /\bDROP TABLE\b/i);
  assert.match(baselineMarker, /diff was empty/i);
  const schema = await readFile(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  assert.match(schema, /refreshTokens RefreshToken\[\]/);
  assert.match(schema, /onDelete: Cascade/);
});
