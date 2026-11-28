import assert from 'node:assert/strict';
import http from 'node:http';
import { test } from 'node:test';
import express, { type Request, type Response, type NextFunction } from 'express';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'mysql://test:test@127.0.0.1:3306/scaniro_test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-that-is-at-least-32-chars';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-that-is-at-least-32-chars';
process.env.AWS_ACCESS_KEY_ID ??= 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY ??= 'test-secret-key';

const { validate } = await import('../src/middlewares/validation.middleware.js');
const { errorHandler } = await import('../src/middlewares/error.middleware.js');
const { logoutSchema } = await import(
  '../src/modules/auth/validation/auth.validation.js'
);
const { AuthController } = await import(
  '../src/modules/auth/controller/auth.controller.js'
);
const { swaggerSpec } = await import('../src/config/swagger.js');

async function withLogoutServer(
  run: (baseUrl: string, calls: Array<string | null | undefined>) => Promise<void>,
): Promise<void> {
  const calls: Array<string | null | undefined> = [];
  const fakeAuthService = {
    logout: async (refreshToken?: string | null) => {
      calls.push(refreshToken);
    },
  };
  const controller = new AuthController(
    fakeAuthService as unknown as ConstructorParameters<typeof AuthController>[0],
  );

  const app = express();
  app.use(express.json());
  app.post('/logout', validate(logoutSchema), controller.logout);
  app.use(errorHandler);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl, calls);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
}

test('POST /auth/logout handles missing, empty, nullable, and valid bodies over Express 5 without 500 TypeError', async () => {
  await withLogoutServer(async (baseUrl, calls) => {
    // Omitted body (req.body is undefined in Express 5) & unauthenticated
    const missingBodyRes = await fetch(`${baseUrl}/logout`, { method: 'POST' });
    assert.equal(missingBodyRes.status, 200);
    assert.deepEqual(await missingBodyRes.json(), {
      success: true,
      message: 'Logged out successfully',
    });

    // Empty object
    const emptyObjRes = await fetch(`${baseUrl}/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(emptyObjRes.status, 200);

    // Empty string (sent by Flutter AuthRepository.logout when refreshToken is missing)
    const emptyStringRes = await fetch(`${baseUrl}/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: '' }),
    });
    assert.equal(emptyStringRes.status, 200);

    // Explicit null
    const nullRes = await fetch(`${baseUrl}/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: null }),
    });
    assert.equal(nullRes.status, 200);

    // Valid token string
    const validRes = await fetch(`${baseUrl}/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'refresh-token-123' }),
    });
    assert.equal(validRes.status, 200);

    assert.deepEqual(calls, [undefined, undefined, '', undefined, 'refresh-token-123']);

    // Invalid refreshToken type -> 422 VALIDATION_ERROR
    const invalidTypeRes = await fetch(`${baseUrl}/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: 12345 }),
    });
    assert.equal(invalidTypeRes.status, 422);
    const invalidPayload = (await invalidTypeRes.json()) as {
      success: boolean;
      error?: { code?: string };
    };
    assert.equal(invalidPayload.success, false);
    assert.equal(invalidPayload.error?.code, 'VALIDATION_ERROR');
  });
});

test('AuthController.logout guards undefined req.body even when invoked directly without validate middleware', async () => {
  const calls: Array<string | null | undefined> = [];
  const fakeAuthService = {
    logout: async (refreshToken?: string | null) => {
      calls.push(refreshToken);
    },
  };
  const controller = new AuthController(
    fakeAuthService as unknown as ConstructorParameters<typeof AuthController>[0],
  );

  let statusCode = 0;
  let body: unknown;
  let forwardedError: unknown;
  const req = {} as Request;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  } as unknown as Response;
  const next: NextFunction = (err?: unknown) => {
    forwardedError = err;
  };

  await controller.logout(req, res, next);
  assert.equal(forwardedError, undefined);
  assert.equal(statusCode, 200);
  assert.deepEqual(body, {
    success: true,
    message: 'Logged out successfully',
    data: undefined,
  });
  assert.deepEqual(calls, [undefined]);
});

test('Swagger /auth/logout aligns with unauthenticated optional nullable refreshToken body', () => {
  const logoutOp = swaggerSpec.paths['/auth/logout']?.post as {
    security?: unknown;
    requestBody?: {
      required?: boolean;
      content?: {
        'application/json'?: {
          schema?: {
            properties?: {
              refreshToken?: { type?: string; nullable?: boolean };
            };
          };
        };
      };
    };
    responses?: Record<string, unknown>;
  };

  assert.ok(logoutOp);
  assert.equal(logoutOp.security, undefined);
  assert.equal(logoutOp.requestBody?.required, false);
  const refreshProp =
    logoutOp.requestBody?.content?.['application/json']?.schema?.properties?.refreshToken;
  assert.equal(refreshProp?.type, 'string');
  assert.equal(refreshProp?.nullable, true);
  assert.ok(logoutOp.responses?.['200']);
  assert.ok(logoutOp.responses?.['422']);
});
