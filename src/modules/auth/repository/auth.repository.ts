import { timingSafeEqual } from 'node:crypto';
import { prisma } from '../../../config/database.js';
import { EmailOtpPurpose, User, RefreshToken } from '@prisma/client';
import { NotFoundError, UnauthorizedError } from '../../../common/errors/app-error.js';
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

  async createUser(data: {
    name: string;
    email: string;
    passwordHash: string;
    emailVerified?: boolean;
  }): Promise<User> {
    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        emailVerified: data.emailVerified ?? true,
      },
    });
  }

  async saveOtp(
    email: string,
    purpose: EmailOtpPurpose,
    codeHash: string,
    expiresAt: Date,
  ): Promise<void> {
    const normalizedEmail = email.toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (!user) throw new NotFoundError('Account no longer exists', 'USER_NOT_FOUND');

    await prisma.emailOtp.upsert({
      where: { email_purpose: { email: normalizedEmail, purpose } },
      create: {
        userId: user.id,
        email: normalizedEmail,
        purpose,
        codeHash,
        expiresAt,
      },
      update: { userId: user.id, codeHash, expiresAt, attempts: 0 },
    });
  }

  async verifyOtp(
    email: string,
    purpose: EmailOtpPurpose,
    codeHash: string,
    consume: boolean,
  ): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const normalizedEmail = email.toLowerCase();
      const now = new Date();
      const otp = await tx.emailOtp.findUnique({
        where: { email_purpose: { email: normalizedEmail, purpose } },
      });
      if (!otp || otp.expiresAt <= now || otp.attempts >= 5) return false;

      if (!this.matchesOtpHash(otp.codeHash, codeHash)) {
        await tx.emailOtp.updateMany({
          where: { id: otp.id, attempts: { lt: 5 } },
          data: { attempts: { increment: 1 } },
        });
        return false;
      }

      if (!consume) return true;

      const consumed = await tx.emailOtp.deleteMany({
        where: {
          id: otp.id,
          codeHash,
          expiresAt: { gt: now },
          attempts: { lt: 5 },
        },
      });
      if (consumed.count !== 1) return false;

      if (purpose === EmailOtpPurpose.SIGNUP) {
        const verified = await tx.user.updateMany({
          where: { email: normalizedEmail, emailVerified: false },
          data: { emailVerified: true },
        });
        return verified.count === 1;
      }
      return true;
    });
  }

  async completePasswordReset(
    email: string,
    codeHash: string,
    passwordHash: string,
  ): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const normalizedEmail = email.toLowerCase();
      const now = new Date();
      const otp = await tx.emailOtp.findUnique({
        where: {
          email_purpose: {
            email: normalizedEmail,
            purpose: EmailOtpPurpose.PASSWORD_RESET,
          },
        },
      });
      if (!otp || otp.expiresAt <= now || otp.attempts >= 5) return false;
      if (!this.matchesOtpHash(otp.codeHash, codeHash)) {
        await tx.emailOtp.updateMany({
          where: { id: otp.id, attempts: { lt: 5 } },
          data: { attempts: { increment: 1 } },
        });
        return false;
      }

      const user = await tx.user.findUnique({ where: { email: normalizedEmail } });
      if (!user || !user.emailVerified || user.lifecycleStatus !== 'ACTIVE') return false;

      const consumed = await tx.emailOtp.deleteMany({
        where: {
          id: otp.id,
          codeHash,
          expiresAt: { gt: now },
          attempts: { lt: 5 },
        },
      });
      if (consumed.count !== 1) return false;

      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });
      await tx.refreshToken.deleteMany({ where: { userId: user.id } });
      return true;
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

  private matchesOtpHash(storedHash: string, submittedHash: string): boolean {
    const stored = Buffer.from(storedHash, 'hex');
    const submitted = Buffer.from(submittedHash, 'hex');
    return stored.length === submitted.length && timingSafeEqual(stored, submitted);
  }
}
