import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'mysql://test:test@127.0.0.1:3306/scaniro_test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-that-is-at-least-32-chars';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-that-is-at-least-32-chars';
process.env.OTP_HASH_SECRET ??= 'test-otp-hash-secret-that-is-at-least-32-chars';
process.env.AWS_ACCESS_KEY_ID ??= 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY ??= 'test-secret-key';
process.env.SMTP_HOST ??= 'localhost';
process.env.SMTP_PORT ??= '1025';
process.env.SMTP_USER ??= 'test@example.com';
process.env.SMTP_PASSWORD ??= 'test-smtp-password';
process.env.SMTP_FROM ??= 'test@example.com';

const { swaggerSpec } = await import('../src/config/swagger.js');

test('swaggerSpec aligns schemas and paths with runtime validators and controllers', () => {
  const schemas = swaggerSpec.components.schemas as Record<string, Record<string, any>>;

  // ErrorResponse uses array details and ValidationError maps to 422
  assert.equal(schemas.ErrorResponse.properties.error.properties.details.type, 'array');
  assert.equal(schemas.ErrorResponse.properties.error.properties.details.nullable, true);

  // User & /users/profile exclude non-existent avatarUrl
  assert.equal(schemas.User.properties.avatarUrl, undefined);
  assert.equal(
    (swaggerSpec.paths['/users/profile'].patch as any).requestBody.content['application/json']
      .schema.properties.avatarUrl,
    undefined,
  );

  // AuthTokens & /auth/refresh match flat token payload without expiresIn
  assert.equal(schemas.AuthTokens.properties.expiresIn, undefined);
  assert.equal(
    (swaggerSpec.paths['/auth/refresh'].post as any).responses['200'].content['application/json']
      .schema.properties.data.$ref,
    '#/components/schemas/AuthTokens',
  );

  // Folder & CreateFolderDto match Prisma _count.documents and optional uuid id
  assert.equal(schemas.Folder.properties.documentCount, undefined);
  assert.ok(schemas.Folder.properties._count.properties.documents);
  assert.equal(schemas.CreateFolderDto.properties.id.format, 'uuid');

  // CreateDocumentDto / UpdateDocumentDto match title max 255 & UpdateDocumentDto pages/pageCount
  assert.equal(schemas.CreateDocumentDto.properties.title.maxLength, 255);
  assert.equal(schemas.UpdateDocumentDto.properties.title.maxLength, 255);
  assert.ok(schemas.UpdateDocumentDto.properties.pageCount);
  assert.ok(schemas.UpdateDocumentDto.properties.pages);

  // Uploads.folder omits 'avatars' and includes 'documents'
  assert.deepEqual(
    schemas.GetPresignedUrlDto.properties.folder.enum,
    ['documents', 'pages', 'thumbnails', 'pdfs'],
  );

  // DELETE /users/account documents 202 DELETING and 200 COMPLETED
  const deleteAccountResponses = (swaggerSpec.paths['/users/account'].delete as any).responses;
  assert.ok(deleteAccountResponses['202']);
  assert.equal(
    deleteAccountResponses['202'].content['application/json'].schema.properties.data.properties
      .status.enum[0],
    'DELETING',
  );
  assert.ok(deleteAccountResponses['200']);

  // GET /documents query params (q, favorite) and pagination fields (totalCount, hasNextPage, hasPrevPage)
  const listDocsOp = swaggerSpec.paths['/documents'].get as any;
  const paramNames = (listDocsOp.parameters as Array<{ name: string }>).map((p) => p.name);
  assert.ok(paramNames.includes('q'));
  assert.ok(paramNames.includes('favorite'));
  assert.equal(paramNames.includes('search'), false);
  assert.equal(paramNames.includes('isFavorite'), false);

  const paginationProps =
    listDocsOp.responses['200'].content['application/json'].schema.properties.data.properties
      .pagination.properties;
  assert.ok(paginationProps.totalCount);
  assert.ok(paginationProps.hasNextPage);
  assert.ok(paginationProps.hasPrevPage);
  assert.equal(paginationProps.total, undefined);
});
