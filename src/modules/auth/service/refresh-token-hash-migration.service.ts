import { hashRefreshToken } from '../../../common/utils/jwt.util.js';

export interface RefreshTokenHashMigrationRepository {
  findRefreshTokensForHashMigration(): Promise<
    { id: string; tokenHash: string }[]
  >;
  replaceLegacyRefreshToken(
    id: string,
    legacyRawToken: string,
    tokenHash: string,
  ): Promise<boolean>;
}

export async function hashLegacyRefreshTokens(
  repository: RefreshTokenHashMigrationRepository,
): Promise<number> {
  const sessions = await repository.findRefreshTokensForHashMigration();
  let migrated = 0;

  for (const session of sessions) {
    if (/^[a-f\d]{64}$/i.test(session.tokenHash)) continue;
    const tokenHash = hashRefreshToken(session.tokenHash);
    if (
      await repository.replaceLegacyRefreshToken(
        session.id,
        session.tokenHash,
        tokenHash,
      )
    ) {
      migrated++;
    }
  }

  return migrated;
}
