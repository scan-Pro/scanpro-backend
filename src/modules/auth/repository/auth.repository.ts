import { prisma } from '../../../config/database.js';
import { User, RefreshToken } from '@prisma/client';
import { UnauthorizedError } from '../../../common/errors/app-error.js';
import { assertUserActive } from '../../../common/utils/account-lifecycle.util.js';

export class AuthRepository {
  async findUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async findUserById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async createUser(data: { name: string; email: string; passwordHash: string }): Promise<User> {
    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
      },
    });
  }

  async saveRefreshToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<RefreshToken> {
    return prisma.$transaction(async (tx) => {
      await assertUserActive(tx, userId);
      return tx.refreshToken.create({
        data: { userId, tokenHash, expiresAt },
      });
    });
  }

  async findRefreshToken(
    tokenHash: string,
  ): Promise<(RefreshToken & { user: User }) | null> {
    return prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  }

  async findLegacyRefreshToken(
    rawToken: string,
  ): Promise<(RefreshToken & { user: User }) | null> {
    return prisma.refreshToken.findUnique({
      where: { tokenHash: rawToken },
      include: { user: true },
    });
  }

  async deleteRefreshToken(tokenHash: string, legacyRawToken?: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: {
        tokenHash: {
          in: legacyRawToken ? [tokenHash, legacyRawToken] : [tokenHash],
        },
      },
    });
  }

  async rotateRefreshToken(data: {
    oldRecordId: string;
    userId: string;
    oldStoredValue: string;
    newTokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await assertUserActive(tx, data.userId);
      await tx.refreshToken.create({
        data: {
          userId: data.userId,
          tokenHash: data.newTokenHash,
          expiresAt: data.expiresAt,
        },
      });

      const consumed = await tx.refreshToken.deleteMany({
        where: {
          id: data.oldRecordId,
          userId: data.userId,
          tokenHash: data.oldStoredValue,
        },
      });
      if (consumed.count !== 1) {
        throw new UnauthorizedError(
          'Refresh token has already been used',
          'REFRESH_TOKEN_REUSED',
        );
      }
    });
  }

  async deleteExpiredRefreshToken(id: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { id, expiresAt: { lte: new Date() } },
    });
  }

  async findRefreshTokensForHashMigration(): Promise<
    { id: string; tokenHash: string }[]
  > {
    return prisma.refreshToken.findMany({
      select: { id: true, tokenHash: true },
    });
  }

  async replaceLegacyRefreshToken(
    id: string,
    legacyRawToken: string,
    tokenHash: string,
  ): Promise<boolean> {
    const result = await prisma.refreshToken.updateMany({
      where: { id, tokenHash: legacyRawToken },
      data: { tokenHash },
    });
    return result.count === 1;
  }

  async deleteAllUserRefreshTokens(userId: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }
}
