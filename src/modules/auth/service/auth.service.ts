import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import ms from 'ms';
import { AuthRepository } from '../repository/auth.repository.js';
import { RegisterDto, LoginDto, RefreshTokenDto } from '../dto/auth.dto.js';
import { ConflictError, UnauthorizedError } from '../../../common/errors/app-error.js';
import { env } from '../../../config/env.js';
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
  }): Promise<AuthUser>;
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
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.authRepository.findUserByEmail(dto.email);
    if (existing) {
      throw new ConflictError('User with this email already exists', 'USER_ALREADY_EXISTS');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const user = await this.authRepository.createUser({
      name: dto.name.trim(),
      email: dto.email.trim(),
      passwordHash,
    });

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

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.authRepository.findUserByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const isValidPassword = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
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

  async logout(refreshToken: string): Promise<void> {
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
