import assert from 'node:assert/strict';
import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'mysql://root:password@127.0.0.1:3306/scanpro_test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-chars';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-chars';
process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';

const { errorHandler } = await import('../src/middlewares/error.middleware.js');
const { ValidationError } = await import('../src/common/errors/app-error.js');

const invokeErrorHandler = (error: Error) => {
  const state: { statusCode: number; body: unknown } = {
    statusCode: 200,
    body: undefined,
  };
  let response: Response;
  response = {
    headersSent: false,
    status(statusCode: number) {
      state.statusCode = statusCode;
      return response;
    },
    json(body: unknown) {
      state.body = body;
      return response;
    },
  } as unknown as Response;

  errorHandler(error, {} as Request, response, (() => {}) as NextFunction);
  return state;
};

test('maps malformed JSON parser errors to the standard 400 error envelope', () => {
  const error = Object.assign(new SyntaxError('invalid JSON'), {
    type: 'entity.parse.failed',
    status: 400,
  });
  const result = invokeErrorHandler(error);

  assert.equal(result.statusCode, 400);
  assert.deepEqual(result.body, {
    success: false,
    message: 'Malformed JSON request body',
    error: { code: 'INVALID_JSON' },
  });
});

test('maps known Prisma conflicts to HTTP 409', () => {
  const error = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
    code: 'P2002',
    clientVersion: 'test',
  });
  const result = invokeErrorHandler(error);

  assert.equal(result.statusCode, 409);
  assert.deepEqual(result.body, {
    success: false,
    message: 'A record with these details already exists',
    error: { code: 'CONFLICT' },
  });
});

test('preserves application validation status and error code', () => {
  const result = invokeErrorHandler(
    new ValidationError('Input validation failed', [
      { field: 'name', message: 'Required' },
    ]),
  );

  assert.equal(result.statusCode, 422);
  assert.deepEqual(result.body, {
    success: false,
    message: 'Input validation failed',
    error: {
      code: 'VALIDATION_ERROR',
      details: [{ field: 'name', message: 'Required' }],
    },
  });
});
