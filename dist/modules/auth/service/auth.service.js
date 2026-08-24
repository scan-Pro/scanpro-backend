import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AuthRepository } from '../repository/auth.repository.js';
import { ConflictError, UnauthorizedError } from '../../../common/errors/app-error.js';
import { env } from '../../../config/env.js';
export class AuthService {
    authRepository;
    constructor(authRepository = new AuthRepository()) {
        this.authRepository = authRepository;
    }
    async register(dto) {
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
    async login(dto) {
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
    async refreshTokens(dto) {
        const tokenRecord = await this.authRepository.findRefreshToken(dto.refreshToken);
        if (!tokenRecord) {
            throw new UnauthorizedError('Invalid refresh token', 'REFRESH_TOKEN_INVALID');
        }
        if (new Date() > tokenRecord.expiresAt) {
            await this.authRepository.deleteRefreshToken(dto.refreshToken);
            throw new UnauthorizedError('Refresh token has expired', 'REFRESH_TOKEN_EXPIRED');
        }
        // Invalidate old token and issue new token pair
        await this.authRepository.deleteRefreshToken(dto.refreshToken);
        return this.generateTokens(tokenRecord.user.id, tokenRecord.user.email);
    }
    async logout(refreshToken) {
        if (refreshToken) {
            await this.authRepository.deleteRefreshToken(refreshToken);
        }
    }
    async generateTokens(userId, email) {
        const payload = { userId, email };
        const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
            expiresIn: env.JWT_ACCESS_EXPIRES_IN,
        });
        const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
            expiresIn: env.JWT_REFRESH_EXPIRES_IN,
        });
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry for refresh token
        await this.authRepository.saveRefreshToken(userId, refreshToken, expiresAt);
        return {
            accessToken,
            refreshToken,
        };
    }
}
//# sourceMappingURL=auth.service.js.map