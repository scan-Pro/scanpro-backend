import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { makeObjectIdentity } from '../modules/uploads/service/uploads.service.js';

function argumentsMap(argv: string[]): Map<string, string> {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith('--') || !value || value.startsWith('--')) {
      throw new Error('Arguments must be supplied as --name value pairs.');
    }
    args.set(key.slice(2), value);
  }
  return args;
}

function validateExactTarget(userId: string, bucket: string, objectKey: string): void {
  if (bucket !== env.AWS_S3_BUCKET) {
    throw new Error(`Bucket must exactly match configured bucket ${env.AWS_S3_BUCKET}.`);
  }
  const segments = objectKey.split('/');
  if (
    !objectKey ||
    objectKey.includes('\\') ||
    objectKey.includes('\0') ||
    segments.some((segment) => !segment || segment === '.' || segment === '..') ||
    !segments.includes(userId)
  ) {
    throw new Error('Object key must be a canonical key containing the exact owner ID path segment.');
  }
}

async function main(): Promise<void> {
  const args = argumentsMap(process.argv.slice(2));
  const fileJobId = args.get('file-job');
  const accountJobId = args.get('account-job');

  if (Boolean(fileJobId) === Boolean(accountJobId)) {
    throw new Error(
      'Usage: --file-job <job-id> [--bucket <configured-bucket> --key <exact-owner-key>] OR --account-job <job-id>'
    );
  }

  if (fileJobId) {
    const job = await prisma.pendingDeletion.findUnique({ where: { id: fileJobId } });
    if (!job) throw new Error('Cleanup job not found.');
    if (!['DEAD_LETTER', 'FAILED'].includes(job.status)) {
      throw new Error(`Only FAILED/DEAD_LETTER file jobs can be manually requeued (current: ${job.status}).`);
    }

    const bucket = args.get('bucket') ?? job.bucket;
    const objectKey = args.get('key') ?? job.objectKey;
    if (!bucket || !objectKey) {
      throw new Error('Legacy jobs require operator-confirmed --bucket and --key values; do not guess them.');
    }
    validateExactTarget(job.userId, bucket, objectKey);
    const identity = makeObjectIdentity(bucket, objectKey);

    await prisma.$transaction(async (tx) => {
      await tx.pendingDeletion.update({
        where: { id: job.id },
        data: {
          bucket,
          objectKey,
          objectIdentity: identity,
          status: 'PENDING',
          attempts: 0,
          lastError: null,
          leaseToken: null,
          leaseExpiresAt: null,
          notBefore: new Date(),
        },
      });
      await tx.uploadGrant.updateMany({
        where: { userId: job.userId, bucket, objectKey, objectIdentity: identity },
        data: { cleanupDone: false, cleanupState: 'PENDING' },
      });
    });
    console.info(`Requeued storage cleanup job ${job.id} for the configured bucket and validated owner key.`);
    return;
  }

  const job = await prisma.accountDeletionJob.findUnique({ where: { id: accountJobId! } });
  if (!job) throw new Error('Account deletion job not found.');
  if (job.status !== 'FAILED') {
    throw new Error(`Only FAILED account deletion jobs can be requeued (current: ${job.status}).`);
  }
  const deadLetters = await prisma.pendingDeletion.count({
    where: { userId: job.userId, status: 'DEAD_LETTER' },
  });
  if (deadLetters > 0) {
    throw new Error(`Account has ${deadLetters} DEAD_LETTER cleanup item(s); repair/requeue those exact targets first.`);
  }
  await prisma.accountDeletionJob.updateMany({
    where: { id: job.id, status: 'FAILED' },
    data: {
      status: 'PENDING',
      attempts: 0,
      lastError: null,
      leaseToken: null,
      leaseExpiresAt: null,
    },
  });
  console.info(`Requeued account deletion job ${job.id} after confirming no DEAD_LETTER file jobs remain.`);
}

try {
  await main();
} catch (error) {
  console.error('[storage-cleanup-requeue] Refused or failed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
