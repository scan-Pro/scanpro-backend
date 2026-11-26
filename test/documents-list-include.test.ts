import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'mysql://test:test@127.0.0.1:3306/scaniro_test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-that-is-at-least-32-chars';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-that-is-at-least-32-chars';
process.env.AWS_ACCESS_KEY_ID ??= 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY ??= 'test-secret-key';

const { DocumentsRepository } = await import(
  '../src/modules/documents/repository/documents.repository.js'
);

test('findUserDocuments includes ordered pages along with folder relation', async () => {
  let capturedFindManyArgs: Record<string, unknown> | undefined;

  const sampleDocuments = [
    {
      id: 'doc-1',
      userId: 'user-1',
      title: 'Synced Doc',
      folderId: null,
      thumbnailUrl: 'https://cdn.example/thumb.jpg',
      pdfUrl: null,
      pageCount: 2,
      isFavorite: false,
      syncStatus: 'SYNCED',
      createdAt: new Date(),
      updatedAt: new Date(),
      folder: null,
      pages: [
        {
          id: 'page-1',
          documentId: 'doc-1',
          pageOrder: 0,
          imageUrl: 'https://cdn.example/p1.jpg',
          thumbnailUrl: 'https://cdn.example/t1.jpg',
          filter: 'ORIGINAL',
          rotation: 0,
          createdAt: new Date(),
        },
        {
          id: 'page-2',
          documentId: 'doc-1',
          pageOrder: 1,
          imageUrl: 'https://cdn.example/p2.jpg',
          thumbnailUrl: 'https://cdn.example/t2.jpg',
          filter: 'MAGIC_COLOR',
          rotation: 90,
          createdAt: new Date(),
        },
      ],
    },
  ];

  const fakePrisma = {
    document: {
      count: async () => 1,
      findMany: async (args: Record<string, unknown>) => {
        capturedFindManyArgs = args;
        return sampleDocuments;
      },
    },
    $transaction: async (queries: Promise<unknown>[]) => Promise.all(queries),
  };

  const repository = new DocumentsRepository(
    fakePrisma as unknown as ConstructorParameters<typeof DocumentsRepository>[0],
  );
  const result = await repository.findUserDocuments('user-1', {
    page: 1,
    limit: 20,
  });

  assert.equal(result.totalCount, 1);
  assert.equal(result.documents.length, 1);
  assert.equal(result.documents[0].pages?.length, 2);
  assert.deepEqual(capturedFindManyArgs?.include, {
    folder: { select: { id: true, name: true } },
    pages: { orderBy: { pageOrder: 'asc' } },
  });
});
