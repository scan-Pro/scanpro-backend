import { User, RefreshToken } from '@prisma/client';
export declare class AuthRepository {
    findUserByEmail(email: string): Promise<User | null>;
    findUserById(id: string): Promise<User | null>;
    createUser(data: {
        name: string;
        email: string;
        passwordHash: string;
    }): Promise<User>;
    saveRefreshToken(userId: string, token: string, expiresAt: Date): Promise<RefreshToken>;
    findRefreshToken(token: string): Promise<(RefreshToken & {
        user: User;
    }) | null>;
    deleteRefreshToken(token: string): Promise<void>;
    deleteAllUserRefreshTokens(userId: string): Promise<void>;
}
