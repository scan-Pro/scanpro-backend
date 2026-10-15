import { prisma } from '../config/database.js';

async function recover(): Promise<void> {
  try {
    // Check if _prisma_migrations table exists
    const tables = await prisma.$queryRaw<Array<{ TABLE_NAME: string }>>`
      SELECT TABLE_NAME FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '_prisma_migrations'
    `;
    if (tables.length === 0) {
      console.log('No _prisma_migrations table found; skipping recovery.');
      return;
    }

    // Check for failed migration 20261014100000_phase1_deletion_reliability
    const failedMigrations = await prisma.$queryRaw<Array<{ id: string; migration_name: string }>>`
      SELECT id, migration_name FROM _prisma_migrations 
      WHERE migration_name = '20261014100000_phase1_deletion_reliability' 
        AND finished_at IS NULL
    `;

    if (failedMigrations.length === 0) {
      console.log('No failed 20261014100000_phase1_deletion_reliability migration found.');
      return;
    }

    console.log('Found failed migration 20261014100000_phase1_deletion_reliability. Cleaning up partial schema changes...');

    // 1. Clean up users table
    const userColumns = await prisma.$queryRaw<Array<{ COLUMN_NAME: string }>>`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'lifecycle_status'
    `;
    if (userColumns.length > 0) {
      console.log('Dropping users.lifecycle_status column...');
      await prisma.$executeRawUnsafe(`ALTER TABLE \`users\` DROP COLUMN \`lifecycle_status\``);
    }

    // 2. Clean up pending_deletions indexes and columns
    const pdIndexes = await prisma.$queryRaw<Array<{ INDEX_NAME: string }>>`
      SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pending_deletions' 
        AND INDEX_NAME IN ('pending_deletions_status_lease_created_idx', 'pending_deletions_bucket_object_idx')
    `;
    for (const idx of pdIndexes) {
      console.log(`Dropping pending_deletions index ${idx.INDEX_NAME}...`);
      await prisma.$executeRawUnsafe(`ALTER TABLE \`pending_deletions\` DROP INDEX \`${idx.INDEX_NAME}\``);
    }

    const pdColumns = await prisma.$queryRaw<Array<{ COLUMN_NAME: string }>>`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pending_deletions' 
        AND COLUMN_NAME IN ('bucket', 'object_key', 'lease_token', 'lease_until')
    `;
    if (pdColumns.length > 0) {
      const dropClause = pdColumns.map((c) => `DROP COLUMN \`${c.COLUMN_NAME}\``).join(', ');
      console.log(`Dropping pending_deletions columns: ${dropClause}...`);
      await prisma.$executeRawUnsafe(`ALTER TABLE \`pending_deletions\` ${dropClause}`);
    }

    // 3. Drop tables upload_grants, account_deletion_jobs, document_deletion_tombstones if partially created
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS \`account_deletion_jobs\``);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS \`upload_grants\``);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS \`document_deletion_tombstones\``);

    // 4. Remove failed record from _prisma_migrations so Prisma can re-apply the corrected migration
    console.log('Removing failed migration record from _prisma_migrations...');
    await prisma.$executeRawUnsafe(`
      DELETE FROM \`_prisma_migrations\` 
      WHERE \`migration_name\` = '20261014100000_phase1_deletion_reliability' 
        AND \`finished_at\` IS NULL
    `);

    console.log('✅ Successfully cleaned up partial migration state. Ready for fresh migration deploy.');
  } catch (error) {
    console.error('Error during migration recovery:', error);
  } finally {
    await prisma.$disconnect();
  }
}

recover();
