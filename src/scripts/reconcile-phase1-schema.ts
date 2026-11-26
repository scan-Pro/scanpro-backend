import { execFileSync } from 'node:child_process';
import { prisma } from '../config/database.js';

const MIGRATION_NAME = '20261019180000_phase1_sync_storage_reliability';

async function tableExists(tableName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    tableName,
  );
  return Number(rows[0]?.cnt ?? 0) > 0;
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    tableName,
    columnName,
  );
  return Number(rows[0]?.cnt ?? 0) > 0;
}

async function indexExists(tableName: string, indexName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    tableName,
    indexName,
  );
  return Number(rows[0]?.cnt ?? 0) > 0;
}

async function dropForeignKeysReferencingUsers(tableName: string): Promise<void> {
  const rows = await prisma.$queryRawUnsafe<Array<{ CONSTRAINT_NAME: string }>>(
    `SELECT DISTINCT CONSTRAINT_NAME
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND REFERENCED_TABLE_NAME = 'users'`,
    tableName,
  );
  for (const row of rows) {
    if (!/^[A-Za-z0-9_]+$/.test(row.CONSTRAINT_NAME)) continue;
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${row.CONSTRAINT_NAME}\``,
    );
  }
}

async function main(): Promise<void> {
  const hasLifecycle = await columnExists('users', 'lifecycle_status');
  if (!hasLifecycle) {
    console.log('Fresh schema detected; skipping Phase 1 reconciliation.');
    return;
  }

  // Check if the target migration is already cleanly applied.
  const migrationRows = await prisma.$queryRawUnsafe<
    Array<{ finished_at: Date | null; rolled_back_at: Date | null }>
  >(
    `SELECT finished_at, rolled_back_at
     FROM _prisma_migrations
     WHERE migration_name = ?
     ORDER BY started_at DESC
     LIMIT 1`,
    MIGRATION_NAME,
  );
  const latest = migrationRows[0];
  if (latest && latest.finished_at !== null && latest.rolled_back_at === null) {
    console.log(`Migration ${MIGRATION_NAME} is already applied.`);
    return;
  }

  console.log(`Reconciling existing Phase 1 schema for ${MIGRATION_NAME}...`);

  // 1. Reconcile pending_deletions
  await prisma.$executeRawUnsafe(
    `ALTER TABLE \`pending_deletions\`
     MODIFY COLUMN \`status\` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER') NOT NULL DEFAULT 'PENDING'`,
  );
  if (!(await columnExists('pending_deletions', 'bucket'))) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`pending_deletions\` ADD COLUMN \`bucket\` VARCHAR(100) NULL`,
    );
  }
  if (!(await columnExists('pending_deletions', 'object_key'))) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`pending_deletions\` ADD COLUMN \`object_key\` VARCHAR(500) NULL`,
    );
  }
  if (!(await columnExists('pending_deletions', 'available_at'))) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`pending_deletions\` ADD COLUMN \`available_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)`,
    );
  }
  if (!(await columnExists('pending_deletions', 'claim_token'))) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`pending_deletions\` ADD COLUMN \`claim_token\` VARCHAR(36) NULL`,
    );
  }
  if (!(await columnExists('pending_deletions', 'lease_expires_at'))) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`pending_deletions\` ADD COLUMN \`lease_expires_at\` DATETIME(3) NULL`,
    );
  }

  await prisma.$executeRawUnsafe(
    `UPDATE \`pending_deletions\`
     SET \`status\` = 'FAILED',
         \`last_error\` = 'Legacy cleanup target needs operator-reviewed bucket/key inventory'
     WHERE (\`bucket\` IS NULL OR \`object_key\` IS NULL OR \`bucket\` = '' OR \`object_key\` = '')
       AND \`status\` IN ('PENDING', 'FAILED')`,
  );

  if (!(await indexExists('pending_deletions', 'pending_deletions_claim_idx'))) {
    await prisma.$executeRawUnsafe(
      `CREATE INDEX \`pending_deletions_claim_idx\` ON \`pending_deletions\` (\`status\`, \`available_at\`, \`created_at\`)`,
    );
  }
  if (!(await indexExists('pending_deletions', 'pending_deletions_object_idx'))) {
    await prisma.$executeRawUnsafe(
      `CREATE INDEX \`pending_deletions_object_idx\` ON \`pending_deletions\` (\`bucket\`, \`object_key\`)`,
    );
  }

  // 2. Reconcile document_tombstones (and migrate any rows from legacy document_deletion_tombstones)
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS \`document_tombstones\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`user_id\` VARCHAR(191) NOT NULL,
      \`document_id\` VARCHAR(191) NOT NULL,
      \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE INDEX \`document_tombstones_user_document_key\` (\`user_id\`, \`document_id\`),
      INDEX \`document_tombstones_user_created_idx\` (\`user_id\`, \`created_at\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  if (await tableExists('document_deletion_tombstones')) {
    await prisma.$executeRawUnsafe(
      `INSERT IGNORE INTO \`document_tombstones\` (\`id\`, \`user_id\`, \`document_id\`, \`created_at\`)
       SELECT \`id\`, \`user_id\`, \`document_id\`, \`created_at\` FROM \`document_deletion_tombstones\``,
    );
  }

  // 3. Reconcile upload_grants
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS \`upload_grants\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`user_id\` VARCHAR(191) NOT NULL,
      \`bucket\` VARCHAR(100) NULL,
      \`object_key\` VARCHAR(500) NULL,
      \`file_url\` VARCHAR(500) NOT NULL,
      \`issued_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`expires_at\` DATETIME(3) NOT NULL,
      \`cleanup_done\` BOOLEAN NOT NULL DEFAULT false,
      \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE INDEX \`upload_grants_bucket_object_key_key\` (\`bucket\`, \`object_key\`),
      INDEX \`upload_grants_user_expiry_idx\` (\`user_id\`, \`expires_at\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await dropForeignKeysReferencingUsers('upload_grants');
  await prisma.$executeRawUnsafe(
    `ALTER TABLE \`upload_grants\`
     MODIFY COLUMN \`bucket\` VARCHAR(100) NULL,
     MODIFY COLUMN \`object_key\` VARCHAR(500) NULL`,
  );
  if (!(await columnExists('upload_grants', 'file_url'))) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`upload_grants\` ADD COLUMN \`file_url\` VARCHAR(500) NOT NULL DEFAULT ''`,
    );
  }
  if (!(await columnExists('upload_grants', 'issued_at'))) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`upload_grants\` ADD COLUMN \`issued_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)`,
    );
  }

  // 4. Reconcile account_deletion_jobs
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS \`account_deletion_jobs\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`user_id\` VARCHAR(191) NOT NULL,
      \`status\` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER') NOT NULL DEFAULT 'PENDING',
      \`attempts\` INTEGER NOT NULL DEFAULT 0,
      \`last_error\` TEXT NULL,
      \`claim_token\` VARCHAR(36) NULL,
      \`lease_expires_at\` DATETIME(3) NULL,
      \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\` DATETIME(3) NOT NULL,
      UNIQUE INDEX \`account_deletion_jobs_user_id_key\` (\`user_id\`),
      INDEX \`account_deletion_jobs_claim_idx\` (\`status\`, \`lease_expires_at\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await dropForeignKeysReferencingUsers('account_deletion_jobs');
  await prisma.$executeRawUnsafe(
    `ALTER TABLE \`account_deletion_jobs\`
     MODIFY COLUMN \`status\` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER') NOT NULL DEFAULT 'PENDING'`,
  );
  if (!(await columnExists('account_deletion_jobs', 'claim_token'))) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`account_deletion_jobs\` ADD COLUMN \`claim_token\` VARCHAR(36) NULL`,
    );
  }
  if (!(await columnExists('account_deletion_jobs', 'lease_expires_at'))) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`account_deletion_jobs\` ADD COLUMN \`lease_expires_at\` DATETIME(3) NULL`,
    );
  }
  if (!(await indexExists('account_deletion_jobs', 'account_deletion_jobs_claim_idx'))) {
    await prisma.$executeRawUnsafe(
      `CREATE INDEX \`account_deletion_jobs_claim_idx\` ON \`account_deletion_jobs\` (\`status\`, \`lease_expires_at\`)`,
    );
  }

  // 5. Reconcile account_deletion_receipts
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS \`account_deletion_receipts\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`user_id\` VARCHAR(191) NOT NULL,
      \`completed_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`objects_queued\` INTEGER NOT NULL DEFAULT 0,
      UNIQUE INDEX \`account_deletion_receipts_user_id_key\` (\`user_id\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );

  // 6. Mark failed migration rolled back (if any) and mark target migration applied
  if (latest && latest.finished_at === null && latest.rolled_back_at === null) {
    execFileSync('npx', ['prisma', 'migrate', 'resolve', '--rolled-back', MIGRATION_NAME], {
      stdio: 'inherit',
    });
  }
  execFileSync('npx', ['prisma', 'migrate', 'resolve', '--applied', MIGRATION_NAME], {
    stdio: 'inherit',
  });
  console.log(`Phase 1 schema reconciled and ${MIGRATION_NAME} marked applied.`);
}

try {
  await main();
} catch (error) {
  console.error('Phase 1 schema reconciliation failed:', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
