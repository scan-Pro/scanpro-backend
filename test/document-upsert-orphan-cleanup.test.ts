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
process.env.AWS_REGION ??= 'us-east-005';
process.env.AWS_S3_BUCKET ??= 'scaniro-app';
process.env.AWS_ENDPOINT ??= 'https://s3.us-east-005.backblazeb2.com';

const { DocumentsRepository } = await import(
  '../src/modules/documents/repository/documents.repository.js'
);
const { DocumentsService } = await import(
  '../src/modules/documents/service/documents.service.js'
);

type StoredPage = {
  id: string;
  documentId: string;
  pageOrder: number;
  imageUrl: string;
  thumbnailUrl: string | null;
  filter: string;
  rotation: number;
  createdAt: Date;
};

type StoredDoc = {
  id: string;
  userId: string;
  title: string;
  folderId: string | null;
  thumbnailUrl: string | null;
  pdfUrl: string | null;
  pageCount: number;
  isFavorite: boolean;
  syncStatus: string;
  createdAt: Date;
  updatedAt: Date;
};

type StoredPendingDeletion = {
  fileUrl: string;
  bucket: string | null;
  objectKey: string | null;
  documentId: string;
  userId: string;
  status: string;
  availableAt?: Date;
  lastError?: string | null;
};

const storageUrl = (userId: string, folder: string, fileName: string) =>
  `https://s3.us-east-005.backblazeb2.com/scaniro-app/${folder}/${userId}/${fileName}`;

const testResolveObjectUrl = (url: string, userId: string) => {
  const parsed = new URL(url);
  if (parsed.origin !== 'https://s3.us-east-005.backblazeb2.com') {
    throw new Error('Foreign host');
  }
  const prefix = '/scaniro-app/';
  if (!parsed.pathname.startsWith(prefix)) {
    throw new Error('Wrong bucket');
  }
  const key = decodeURIComponent(parsed.pathname.slice(prefix.length));
  const parts = key.split('/');
  if (parts.length < 3 || parts[1] !== userId) {
    throw new Error('Wrong owner');
  }
  return { bucket: 'scaniro-app', key };
};

function createFakeTransactionalDb(userId: string) {
  const documents = new Map<string, StoredDoc>();
  const pages = new Map<string, StoredPage[]>();
  const uploadGrants: Array<{
    userId: string;
    bucket: string;
    objectKey: string;
    expiresAt: Date;
  }> = [];
  const pendingDeletions: StoredPendingDeletion[] = [];
  let pageSeq = 0;

  const hydrate = (doc: StoredDoc) => ({
    ...doc,
    folder: null,
    pages: [...(pages.get(doc.id) ?? [])].sort((a, b) => a.pageOrder - b.pageOrder),
  });

  const tx = {
    $queryRaw: async () => [{ id: userId, lifecycle_status: 'ACTIVE' }],
    documentTombstone: {
      findUnique: async () => null,
    },
    document: {
      findFirst: async (args: { where: { id: string; userId: string }; select?: { id: boolean } }) => {
        const found = documents.get(args.where.id);
        if (!found || found.userId !== args.where.userId) return null;
        if (args.select?.id) return { id: found.id };
        return hydrate(found);
      },
      findFirstOrThrow: async (args: { where: { id: string; userId: string } }) => {
        const found = documents.get(args.where.id);
        if (!found || found.userId !== args.where.userId) {
          throw new Error('Document not found');
        }
        return hydrate(found);
      },
      updateMany: async (args: {
        where: { id: string; userId: string };
        data: Record<string, unknown>;
      }) => {
        const found = documents.get(args.where.id);
        if (!found || found.userId !== args.where.userId) return { count: 0 };
        documents.set(args.where.id, {
          ...found,
          ...(args.data as Partial<StoredDoc>),
        });
        return { count: 1 };
      },
      create: async (args: {
        data: {
          id?: string;
          userId: string;
          title: string;
          folderId?: string | null;
          thumbnailUrl?: string | null;
          pdfUrl?: string | null;
          pageCount: number;
          isFavorite?: boolean;
          createdAt?: Date;
          updatedAt?: Date;
          pages?: {
            create?: Array<{
              id?: string;
              pageOrder?: number;
              imageUrl: string;
              thumbnailUrl?: string | null;
              filter?: string;
              rotation?: number;
            }>;
          };
        };
      }) => {
        const docId = args.data.id ?? `doc-${documents.size + 1}`;
        const now = new Date();
        const stored: StoredDoc = {
          id: docId,
          userId: args.data.userId,
          title: args.data.title,
          folderId: args.data.folderId ?? null,
          thumbnailUrl: args.data.thumbnailUrl ?? null,
          pdfUrl: args.data.pdfUrl ?? null,
          pageCount: args.data.pageCount,
          isFavorite: args.data.isFavorite ?? false,
          syncStatus: 'SYNCED',
          createdAt: args.data.createdAt ?? now,
          updatedAt: args.data.updatedAt ?? now,
        };
        documents.set(docId, stored);
        const createdPages = (args.data.pages?.create ?? []).map((p, idx) => ({
          id: p.id ?? `page-${++pageSeq}`,
          documentId: docId,
          pageOrder: p.pageOrder ?? idx,
          imageUrl: p.imageUrl,
          thumbnailUrl: p.thumbnailUrl ?? null,
          filter: p.filter ?? 'ORIGINAL',
          rotation: p.rotation ?? 0,
          createdAt: now,
        }));
        pages.set(docId, createdPages);
        return hydrate(stored);
      },
    },
    documentPage: {
      deleteMany: async (args: { where: { documentId: string } }) => {
        pages.delete(args.where.documentId);
        return { count: 1 };
      },
      createMany: async (args: {
        data: Array<{
          id?: string;
          documentId: string;
          pageOrder?: number;
          imageUrl: string;
          thumbnailUrl?: string | null;
          filter?: string;
          rotation?: number;
        }>;
      }) => {
        if (args.data.length === 0) return { count: 0 };
        const docId = args.data[0].documentId;
        const now = new Date();
        pages.set(
          docId,
          args.data.map((p, idx) => ({
            id: p.id ?? `page-${++pageSeq}`,
            documentId: docId,
            pageOrder: p.pageOrder ?? idx,
            imageUrl: p.imageUrl,
            thumbnailUrl: p.thumbnailUrl ?? null,
            filter: p.filter ?? 'ORIGINAL',
            rotation: p.rotation ?? 0,
            createdAt: now,
          })),
        );
        return { count: args.data.length };
      },
    },
    uploadGrant: {
      findMany: async (args: { where: { userId: string; bucket: string; objectKey: string } }) =>
        uploadGrants
          .filter(
            (g) =>
              g.userId === args.where.userId &&
              g.bucket === args.where.bucket &&
              g.objectKey === args.where.objectKey,
          )
          .map((g) => ({ expiresAt: g.expiresAt })),
    },
    pendingDeletion: {
      create: async (args: { data: StoredPendingDeletion }) => {
        pendingDeletions.push(args.data);
        return args.data;
      },
    },
  };

  const db = {
    $transaction: async <T>(fn: (client: typeof tx) => Promise<T>) => fn(tx),
  };

  return { db, documents, pages, uploadGrants, pendingDeletions };
}

test('createDocument upsert enqueues replaced PDF, cover thumbnail, and deleted page objects while sparing retained shared URLs', async () => {
  const userId = 'user-1';
  const docId = 'doc-1';
  const { db, uploadGrants, pendingDeletions } = createFakeTransactionalDb(userId);
  const repository = new DocumentsRepository(
    db as unknown as ConstructorParameters<typeof DocumentsRepository>[0],
  );

  const coverV1 = storageUrl(userId, 'thumbnails', 'cover-v1.jpg');
  const pdfV1 = storageUrl(userId, 'pdfs', 'doc-v1.pdf');
  const p1Img = storageUrl(userId, 'pages', 'p1-v1.jpg');
  const sharedThumb = storageUrl(userId, 'thumbnails', 'shared-thumb.jpg');
  const p2Img = storageUrl(userId, 'pages', 'p2-v1.jpg');
  const p2Thumb = storageUrl(userId, 'thumbnails', 'p2-thumb.jpg');
  const pdfV2 = storageUrl(userId, 'pdfs', 'doc-v2.pdf');

  const grantExpiry = new Date(Date.now() + 20 * 60 * 1000);
  uploadGrants.push({
    userId,
    bucket: 'scaniro-app',
    objectKey: `pdfs/${userId}/doc-v1.pdf`,
    expiresAt: grantExpiry,
  });

  await repository.createDocument(
    userId,
    {
      id: docId,
      title: 'Contract',
      thumbnailUrl: coverV1,
      pdfUrl: pdfV1,
      pages: [
        { id: 'page-1', pageOrder: 0, imageUrl: p1Img, thumbnailUrl: sharedThumb },
        { id: 'page-2', pageOrder: 1, imageUrl: p2Img, thumbnailUrl: p2Thumb },
      ],
    },
    testResolveObjectUrl,
  );
  assert.equal(pendingDeletions.length, 0);

  const beforeUpsert = Date.now();
  const updated = await repository.createDocument(
    userId,
    {
      id: docId,
      title: 'Contract Edited',
      // sharedThumb moves from page-1.thumbnailUrl to document.thumbnailUrl so it stays referenced.
      thumbnailUrl: sharedThumb,
      pdfUrl: pdfV2,
      pages: [
        { id: 'page-1', pageOrder: 0, imageUrl: p1Img },
      ],
    },
    testResolveObjectUrl,
  );

  assert.equal(updated.pages?.length, 1);
  assert.equal(updated.pdfUrl, pdfV2);

  const queuedKeys = pendingDeletions.map((d) => `${d.status}:${d.objectKey}`).sort();
  assert.deepEqual(queuedKeys, [
    `PENDING:pages/${userId}/p2-v1.jpg`,
    `PENDING:pdfs/${userId}/doc-v1.pdf`,
    `PENDING:thumbnails/${userId}/cover-v1.jpg`,
    `PENDING:thumbnails/${userId}/p2-thumb.jpg`,
  ]);

  const pdfRow = pendingDeletions.find((d) => d.objectKey === `pdfs/${userId}/doc-v1.pdf`);
  assert.equal(pdfRow?.availableAt?.getTime(), grantExpiry.getTime() + 5 * 60 * 1000);

  const coverRow = pendingDeletions.find((d) => d.objectKey === `thumbnails/${userId}/cover-v1.jpg`);
  assert.ok((coverRow?.availableAt?.getTime() ?? 0) >= beforeUpsert + 60 * 60 * 1000);
});

test('createDocument upsert deduplicates shared removed URLs and marks unvalidated external URLs FAILED', async () => {
  const userId = 'user-2';
  const docId = 'doc-2';
  const { db, pendingDeletions } = createFakeTransactionalDb(userId);
  const repository = new DocumentsRepository(
    db as unknown as ConstructorParameters<typeof DocumentsRepository>[0],
  );

  const sharedOldThumb = storageUrl(userId, 'thumbnails', 'shared-old.jpg');
  const p1Old = storageUrl(userId, 'pages', 'p1-old.jpg');
  const foreignUrl = 'https://evil.example/foreign/leak.jpg';
  const pNew = storageUrl(userId, 'pages', 'p-new.jpg');

  await repository.createDocument(
    userId,
    {
      id: docId,
      title: 'Shared Thumb Doc',
      thumbnailUrl: sharedOldThumb,
      pages: [
        { id: 'p1', pageOrder: 0, imageUrl: p1Old, thumbnailUrl: sharedOldThumb },
        { id: 'p2', pageOrder: 1, imageUrl: foreignUrl },
      ],
    },
    testResolveObjectUrl,
  );

  await repository.createDocument(
    userId,
    {
      id: docId,
      title: 'Shared Thumb Doc v2',
      thumbnailUrl: pNew,
      pages: [{ id: 'p1-new', pageOrder: 0, imageUrl: pNew }],
    },
    testResolveObjectUrl,
  );

  const pendingObjects = pendingDeletions.filter((d) => d.status === 'PENDING');
  assert.deepEqual(
    pendingObjects.map((d) => d.objectKey).sort(),
    [`pages/${userId}/p1-old.jpg`, `thumbnails/${userId}/shared-old.jpg`],
  );

  const failedRows = pendingDeletions.filter((d) => d.status === 'FAILED');
  assert.equal(failedRows.length, 1);
  assert.equal(failedRows[0].fileUrl, foreignUrl);
  assert.equal(failedRows[0].bucket, null);
  assert.equal(failedRows[0].objectKey, null);
});

test('updateDocument leaves unchanged assets alone on metadata patch and queues only replaced/removed objects', async () => {
  const userId = 'user-3';
  const docId = 'doc-3';
  const { db, pendingDeletions } = createFakeTransactionalDb(userId);
  const repository = new DocumentsRepository(
    db as unknown as ConstructorParameters<typeof DocumentsRepository>[0],
  );

  const coverUrl = storageUrl(userId, 'thumbnails', 'cover.jpg');
  const pdfOld = storageUrl(userId, 'pdfs', 'signed-v1.pdf');
  const pdfNew = storageUrl(userId, 'pdfs', 'signed-v2.pdf');
  const page1Url = storageUrl(userId, 'pages', 'p1.jpg');
  const page2Url = storageUrl(userId, 'pages', 'p2.jpg');

  await repository.createDocument(
    userId,
    {
      id: docId,
      title: 'Original',
      thumbnailUrl: coverUrl,
      pdfUrl: pdfOld,
      pages: [
        { id: 'p1', pageOrder: 0, imageUrl: page1Url },
        { id: 'p2', pageOrder: 1, imageUrl: page2Url },
      ],
    },
    testResolveObjectUrl,
  );

  await repository.updateDocument(
    docId,
    userId,
    { title: 'Renamed Only' },
    testResolveObjectUrl,
  );
  assert.equal(pendingDeletions.length, 0);

  await repository.updateDocument(
    docId,
    userId,
    {
      pdfUrl: pdfNew,
      pages: [{ id: 'p1', pageOrder: 0, imageUrl: page1Url }],
    },
    testResolveObjectUrl,
  );

  assert.deepEqual(
    pendingDeletions.map((d) => d.objectKey).sort(),
    [`pages/${userId}/p2.jpg`, `pdfs/${userId}/signed-v1.pdf`],
  );
});

test('DocumentsService passes UploadsService.resolveOwnedObjectUrl to createDocument and updateDocument', async () => {
  const userId = 'user-4';
  let createResolver: ((url: string, ownerId: string) => unknown) | undefined;
  let updateResolver: ((url: string, ownerId: string) => unknown) | undefined;
  const resolvedCalls: Array<{ url: string; ownerId: string }> = [];

  const fakeRepo = {
    createDocument: async (
      _uid: string,
      _dto: unknown,
      resolver?: (url: string, ownerId: string) => unknown,
    ) => {
      createResolver = resolver;
      return { id: 'doc-4' };
    },
    updateDocument: async (
      _id: string,
      _uid: string,
      _dto: unknown,
      resolver?: (url: string, ownerId: string) => unknown,
    ) => {
      updateResolver = resolver;
      return { id: 'doc-4' };
    },
  };

  const fakeUploads = {
    resolveOwnedObjectUrl: (url: string, ownerId: string) => {
      resolvedCalls.push({ url, ownerId });
      return { bucket: 'scaniro-app', key: `pages/${ownerId}/sample.jpg` };
    },
  };

  const service = new DocumentsService(
    fakeRepo as unknown as ConstructorParameters<typeof DocumentsService>[0],
    fakeUploads as unknown as ConstructorParameters<typeof DocumentsService>[1],
  );

  const sampleUrl = storageUrl(userId, 'pages', 'sample.jpg');
  await service.createDocument(userId, { title: 'Created', thumbnailUrl: sampleUrl });
  await service.updateDocument('doc-4', userId, { title: 'Updated' });

  assert.ok(createResolver);
  assert.ok(updateResolver);
  // assertOwnFileUrls already validated sampleUrl once during createDocument.
  assert.equal(resolvedCalls.length, 1);
  assert.deepEqual(createResolver!(sampleUrl, userId), {
    bucket: 'scaniro-app',
    key: `pages/${userId}/sample.jpg`,
  });
  assert.deepEqual(updateResolver!(sampleUrl, userId), {
    bucket: 'scaniro-app',
    key: `pages/${userId}/sample.jpg`,
  });
  assert.equal(resolvedCalls.length, 3);
});
