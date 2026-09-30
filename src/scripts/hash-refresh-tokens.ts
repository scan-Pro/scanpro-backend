import { prisma } from '../config/database.js';
import { AuthRepository } from '../modules/auth/repository/auth.repository.js';
import { hashLegacyRefreshTokens } from '../modules/auth/service/refresh-token-hash-migration.service.js';

try {
  const migrated = await hashLegacyRefreshTokens(new AuthRepository());
  console.log(`Hashed ${migrated} legacy refresh session(s).`);
} catch (error) {
  console.error(
    `Refresh-session hashing failed (${error instanceof Error ? error.name : 'UnknownError'}).`,
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
