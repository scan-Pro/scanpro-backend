import bcrypt from 'bcrypt';
import { createHmac, randomInt } from 'node:crypto';
import jwt from 'jsonwebtoken';
import ms from 'ms';
import { EmailOtpPurpose } from '@prisma/client';
import { AuthRepository } from '../repository/auth.repository.js';
import {
  EmailPurposeDto,
  ForgotPasswordDto,
  LoginDto,
  OtpDto,
  OtpPurpose,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
} from '../dto/auth.dto.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
} from '../../../common/errors/app-error.js';
import { env } from '../../../config/env.js';
import { OtpEmailSender, SmtpEmailService } from './email.service.js';
import {
  hashRefreshToken,
  signScaniroToken,
  verifyLegacyRefreshToken,
  verifyScaniroToken,
} from '../../../common/utils/jwt.util.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
  };
  tokens: AuthTokens;
}

interface AuthUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  emailVerified?: boolean;
  lifecycleStatus?: 'ACTIVE' | 'DELETING';
}

interface StoredRefreshSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  user: AuthUser;
}

export interface AuthRepositoryPort {
  findUserByEmail(email: string): Promise<AuthUser | null>;
  createUser(data: {
    name: string;
    email: string;
    passwordHash: string;
    emailVerified?: boolean;
  }): Promise<AuthUser>;
  saveOtp(
    email: string,
    purpose: EmailOtpPurpose,
    codeHash: string,
    expiresAt: Date,
  ): Promise<void>;
  verifyOtp(
    email: string,
    purpose: EmailOtpPurpose,
    codeHash: string,
    consume: boolean,
  ): Promise<boolean>;
  completePasswordReset(
    email: string,
    codeHash: string,
    passwordHash: string,
  ): Promise<boolean>;
  saveRefreshToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<unknown>;
  findRefreshToken(tokenHash: string): Promise<StoredRefreshSession | null>;
  findLegacyRefreshToken(
    rawToken: string,
  ): Promise<StoredRefreshSession | null>;
  deleteRefreshToken(tokenHash: string, legacyRawToken?: string): Promise<void>;
  deleteExpiredRefreshToken(id: string): Promise<void>;
  rotateRefreshToken(data: {
    oldRecordId: string;
    userId: string;
    oldStoredValue: string;
    newTokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  deleteAllUserRefreshTokens(userId: string): Promise<void>;
}

export class AuthService {
  constructor(
    private readonly authRepository: AuthRepositoryPort = new AuthRepository(),
    private readonly emailSender: OtpEmailSender = new SmtpEmailService(),
  ) {}

  async register(dto: RegisterDto): Promise<{ email: string }> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.authRepository.findUserByEmail(email);
    if (existing && existing.emailVerified !== false) {
      throw new ConflictError('User with this email already exists', 'USER_ALREADY_EXISTS');
    }

    const user = existing ?? await this.authRepository.createUser({
      name: dto.name.trim(),
      email,
      passwordHash: await bcrypt.hash(dto.password, 10),
      emailVerified: false,
    });
    await this.sendOtp(user.email, 'signup');
    return { email: user.email };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.authRepository.findUserByEmail(email);
    if (user && user.emailVerified !== false && user.lifecycleStatus !== 'DELETING') {
      await this.sendOtp(email, 'reset');
    }
  }

  async resendOtp(dto: EmailPurposeDto): Promise<void> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.authRepository.findUserByEmail(email);
    if (!user || user.lifecycleStatus === 'DELETING') return;

    if (dto.purpose === 'signup' && user.emailVerified === false) {
      await this.sendOtp(email, 'signup');
    } else if (dto.purpose === 'reset' && user.emailVerified === true) {
      await this.sendOtp(email, 'reset');
    }
  }

  async verifyOtp(dto: OtpDto): Promise<void> {
    const email = dto.email.trim().toLowerCase();
    const purpose = this.toOtpPurpose(dto.purpose);
    const verified = await this.authRepository.verifyOtp(
      email,
      purpose,
      this.hashOtp(email, dto.purpose, dto.otp),
      dto.purpose === 'signup',
    );
    if (!verified) {
      throw new BadRequestError('Invalid or expired OTP', 'OTP_INVALID_OR_EXPIRED');
    }
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const email = dto.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const reset = await this.authRepository.completePasswordReset(
      email,
      this.hashOtp(email, 'reset', dto.otp),
      passwordHash,
    );
    if (!reset) {
      throw new BadRequestError('Invalid or expired OTP', 'OTP_INVALID_OR_EXPIRED');
    }
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.authRepository.findUserByEmail(dto.email.trim().toLowerCase());
    if (!user) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    if (user.lifecycleStatus && user.lifecycleStatus !== 'ACTIVE') {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const isValidPassword = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    if (user.emailVerified === false) {
      throw new ForbiddenError('Verify your email before signing in', 'EMAIL_NOT_VERIFIED');
    }

    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
      tokens,
    };
  }

  async refreshTokens(dto: RefreshTokenDto): Promise<AuthTokens> {
    let claims: { userId: string; email: string };
    let isLegacyToken = false;
    try {
      claims = verifyScaniroToken(
        dto.refreshToken,
        'refresh',
        env.JWT_REFRESH_SECRET,
      );
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError(
          'Refresh token has expired',
          'REFRESH_TOKEN_EXPIRED',
        );
      }
      try {
        claims = verifyLegacyRefreshToken(
          dto.refreshToken,
          env.JWT_REFRESH_SECRET,
        );
        isLegacyToken = true;
      } catch (legacyError) {
        if (legacyError instanceof jwt.TokenExpiredError) {
          throw new UnauthorizedError(
            'Refresh token has expired',
            'REFRESH_TOKEN_EXPIRED',
          );
        }
        throw new UnauthorizedError(
          'Invalid refresh token',
          'REFRESH_TOKEN_INVALID',
        );
      }
    }

    const tokenHash = hashRefreshToken(dto.refreshToken);
    let tokenRecord = await this.authRepository.findRefreshToken(tokenHash);
    if (!tokenRecord && isLegacyToken) {
      tokenRecord = await this.authRepository.findLegacyRefreshToken(
        dto.refreshToken,
      );
    }
    if (!tokenRecord) {
      throw new UnauthorizedError('Invalid refresh token', 'REFRESH_TOKEN_INVALID');
    }

    if (
      claims.userId !== tokenRecord.user.id ||
      claims.email !== tokenRecord.user.email
    ) {
      throw new UnauthorizedError('Invalid refresh token', 'REFRESH_TOKEN_INVALID');
    }

    if (tokenRecord.user.lifecycleStatus && tokenRecord.user.lifecycleStatus !== 'ACTIVE') {
      throw new UnauthorizedError('Account is being deleted', 'ACCOUNT_DELETING');
    }

    if (new Date() >= tokenRecord.expiresAt) {
      await this.authRepository.deleteExpiredRefreshToken(tokenRecord.id);
      throw new UnauthorizedError('Refresh token has expired', 'REFRESH_TOKEN_EXPIRED');
    }

    const next = this.createTokenPair(
      tokenRecord.user.id,
      tokenRecord.user.email,
    );
    await this.authRepository.rotateRefreshToken({
      oldRecordId: tokenRecord.id,
      userId: tokenRecord.user.id,
      oldStoredValue: tokenRecord.tokenHash,
      newTokenHash: next.refreshTokenHash,
      expiresAt: next.expiresAt,
    });
    return {
      accessToken: next.accessToken,
      refreshToken: next.refreshToken,
    };
  }

  async logout(refreshToken?: string | null): Promise<void> {
    if (refreshToken) {
      await this.authRepository.deleteRefreshToken(
        hashRefreshToken(refreshToken),
        refreshToken,
      );
    }
  }

  private async generateTokens(userId: string, email: string): Promise<AuthTokens> {
    const tokens = this.createTokenPair(userId, email);
    await this.authRepository.saveRefreshToken(
      userId,
      tokens.refreshTokenHash,
      tokens.expiresAt,
    );
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  private async sendOtp(email: string, purpose: OtpPurpose): Promise<void> {
    const otp = randomInt(100000, 1000000).toString();
    await this.authRepository.saveOtp(
      email,
      this.toOtpPurpose(purpose),
      this.hashOtp(email, purpose, otp),
      new Date(Date.now() + 10 * 60 * 1000),
    );
    await this.emailSender.sendOtp(email, otp, purpose);
  }

  private hashOtp(email: string, purpose: OtpPurpose, otp: string): string {
    return createHmac('sha256', env.OTP_HASH_SECRET)
      .update(`${email}:${purpose}:${otp}`)
      .digest('hex');
  }

  private toOtpPurpose(purpose: OtpPurpose): EmailOtpPurpose {
    return purpose === 'signup'
      ? EmailOtpPurpose.SIGNUP
      : EmailOtpPurpose.PASSWORD_RESET;
  }

  private createTokenPair(userId: string, email: string) {
    const accessToken = signScaniroToken(
      userId,
      email,
      'access',
      env.JWT_ACCESS_SECRET,
      env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    );
    const refreshToken = signScaniroToken(
      userId,
      email,
      'refresh',
      env.JWT_REFRESH_SECRET,
      env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    );
    const expiresAt = new Date(
      Date.now() + ms(env.JWT_REFRESH_EXPIRES_IN as ms.StringValue),
    );

    return {
      accessToken,
      refreshToken,
      refreshTokenHash: hashRefreshToken(refreshToken),
      expiresAt,
    };
  }
}
