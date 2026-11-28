import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { NextFunction, Request, Response } from 'express';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'mysql://test:test@127.0.0.1:3306/scaniro_test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-that-is-at-least-32-chars';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-that-is-at-least-32-chars';
process.env.AWS_ACCESS_KEY_ID ??= 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY ??= 'test-secret-key';
process.env.AWS_REGION = 'us-east-005';
process.env.AWS_S3_BUCKET = 'scaniro-app';
process.env.AWS_ENDPOINT = 'https://s3.us-east-005.backblazeb2.com';

const { env } = await import('../src/config/env.js');

const { validate } = await import('../src/middlewares/validation.middleware.js');
const { ValidationError } = await import('../src/common/errors/app-error.js');
const {
  createDocumentPageSchema,
  createDocumentSchema,
  updateDocumentSchema,
} = await import('../src/modules/documents/validation/documents.validation.js');
const { DocumentsService } = await import(
  '../src/modules/documents/service/documents.service.js'
);

async function runValidateMiddleware(
  schema: Parameters<typeof validate>[0],
  input: { body?: unknown; query?: unknown; params?: unknown },
): Promise<{ req: Request; error: unknown }> {
  const req = {
    body: input.body ?? {},
    query: input.query ?? {},
    params: input.params ?? {},
  } as Request;

  let capturedError: unknown;
  const next: NextFunction = (err?: unknown) => {
    capturedError = err;
  };

  await validate(schema)(req, {} as Response, next);
  return { req, error: capturedError };
}

test('createDocumentPageSchema allows null, undefined, and string thumbnailUrl across POST and PATCH schemas', async () => {
  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const docId = '550e8400-e29b-41d4-a716-446655440001';
  const page1Id = '550e8400-e29b-41d4-a716-446655440002';
  const page2Id = '550e8400-e29b-41d4-a716-446655440003';
  const pageImgUrl = `https://s3.us-east-005.backblazeb2.com/scaniro-app/pages/${userId}/p1.jpg`;
  const pageThumbUrl = `https://s3.us-east-005.backblazeb2.com/scaniro-app/thumbnails/${userId}/t1.jpg`;

  // Exact shape emitted by Flutter DocumentRemoteRepository.syncDocument when thumbnailUrl is null.
  const createPayload = {
    id: docId,
    title: 'Receipt Scan',
    folderId: null,
    thumbnailUrl: null,
    pdfUrl: null,
    pageCount: 2,
    isFavorite: false,
    createdAt: '2026-11-28T10:00:00.000Z',
    updatedAt: '2026-11-28T10:00:00.000Z',
    pages: [
      {
        id: page1Id,
        pageOrder: 0,
        imageUrl: pageImgUrl,
        thumbnailUrl: null,
        filter: 'ORIGINAL',
        rotation: 0,
      },
      {
        id: page2Id,
        pageOrder: 1,
        imageUrl: pageImgUrl,
        thumbnailUrl: pageThumbUrl,
        filter: 'MAGIC_COLOR',
        rotation: 90,
      },
      {
        pageOrder: 2,
        imageUrl: pageImgUrl,
      },
    ],
  };

  const createResult = await runValidateMiddleware(createDocumentSchema, {
    body: createPayload,
  });
  assert.equal(createResult.error, undefined);
  assert.equal(createResult.req.body.pages[0].thumbnailUrl, null);
  assert.equal(createResult.req.body.pages[1].thumbnailUrl, pageThumbUrl);
  assert.equal(createResult.req.body.pages[2].thumbnailUrl, undefined);

  const updateResult = await runValidateMiddleware(updateDocumentSchema, {
    params: { id: docId },
    body: {
      pages: [
        {
          id: page1Id,
          pageOrder: 0,
          imageUrl: pageImgUrl,
          thumbnailUrl: null,
        },
      ],
    },
  });
  assert.equal(updateResult.error, undefined);
  assert.equal(updateResult.req.body.pages[0].thumbnailUrl, null);

  const directParsed = createDocumentPageSchema.parse({
    pageOrder: 0,
    imageUrl: pageImgUrl,
    thumbnailUrl: null,
  });
  assert.equal(directParsed.thumbnailUrl, null);
});

test('document create and update schemas require UUID format consistently for document, page, and folder IDs', async () => {
  const pageImgUrl = 'https://s3.us-east-005.backblazeb2.com/scaniro-app/pages/u/p1.jpg';
  const validUuid = '550e8400-e29b-41d4-a716-446655440099';

  const badDocId = await runValidateMiddleware(createDocumentSchema, {
    body: { id: 'not-a-uuid', title: 'Bad Doc ID' },
  });
  assert.ok(badDocId.error instanceof ValidationError);
  assert.equal(badDocId.error.statusCode, 422);

  const badPageId = await runValidateMiddleware(createDocumentSchema, {
    body: {
      title: 'Bad Page ID',
      pages: [{ id: 'not-a-uuid', pageOrder: 0, imageUrl: pageImgUrl }],
    },
  });
  assert.ok(badPageId.error instanceof ValidationError);

  const badFolderId = await runValidateMiddleware(updateDocumentSchema, {
    params: { id: validUuid },
    body: { folderId: 'not-a-uuid' },
  });
  assert.ok(badFolderId.error instanceof ValidationError);

  const badParamId = await runValidateMiddleware(updateDocumentSchema, {
    params: { id: 'not-a-uuid' },
    body: { title: 'Updated' },
  });
  assert.ok(badParamId.error instanceof ValidationError);
});

test('createDocumentSchema still rejects non-string page thumbnailUrl values', async () => {
  const result = await runValidateMiddleware(createDocumentSchema, {
    body: {
      title: 'Invalid Page Thumb',
      pages: [
        {
          pageOrder: 0,
          imageUrl: 'https://s3.us-east-005.backblazeb2.com/scaniro-app/pages/u/p1.jpg',
          thumbnailUrl: 12345,
        },
      ],
    },
  });

  assert.ok(result.error instanceof ValidationError);
  assert.equal(result.error.statusCode, 422);
});

test('DocumentsService accepts nullable page thumbnailUrl without throwing INVALID_FILE_URL', async () => {
  const userId = '550e8400-e29b-41d4-a716-446655440010';
  const configuredOrigin = env.AWS_ENDPOINT.includes('backblazeb2.com')
    ? `https://s3.${env.AWS_REGION}.backblazeb2.com`
    : env.AWS_ENDPOINT.trim() !== ''
      ? env.AWS_ENDPOINT.replace(/\/$/, '')
      : `https://s3.${env.AWS_REGION}.amazonaws.com`;
  const ownPageImageUrl = `${configuredOrigin}/${env.AWS_S3_BUCKET}/pages/${userId}/page.jpg`;
  const receivedDtos: unknown[] = [];

  const fakeRepo = {
    createDocument: async (_uid: string, dto: unknown) => {
      receivedDtos.push(dto);
      return { id: 'doc-1', pages: [] };
    },
    updateDocument: async (_id: string, _uid: string, dto: unknown) => {
      receivedDtos.push(dto);
      return { id: 'doc-1', pages: [] };
    },
  };

  const service = new DocumentsService(
    fakeRepo as unknown as ConstructorParameters<typeof DocumentsService>[0],
  );

  await service.createDocument(userId, {
    title: 'Scan Without Page Thumb',
    folderId: null,
    thumbnailUrl: null,
    pdfUrl: null,
    pages: [{ id: 'p-1', pageOrder: 0, imageUrl: ownPageImageUrl, thumbnailUrl: null }],
  });

  await service.updateDocument('doc-1', userId, {
    pages: [{ id: 'p-1', pageOrder: 0, imageUrl: ownPageImageUrl, thumbnailUrl: null }],
  });

  assert.equal(receivedDtos.length, 2);
});
