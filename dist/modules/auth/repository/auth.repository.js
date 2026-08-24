import { prisma } from '../../../config/database.js';
export class AuthRepository {
    async findUserByEmail(email) {
        return prisma.user.findUnique({
            where: { email: email.toLowerCase() },
        });
    }
    async findUserById(id) {
        return prisma.user.findUnique({
            where: { id },
        });
    }
    async createUser(data) {
        return prisma.user.create({
            data: {
                name: data.name,
                email: data.email.toLowerCase(),
                passwordHash: data.passwordHash,
            },
        });
    }
    async saveRefreshToken(userId, token, expiresAt) {
        return prisma.refreshToken.create({
            data: {
                userId,
                token,
                expiresAt,
            },
        });
    }
    async findRefreshToken(token) {
        return prisma.refreshToken.findUnique({
            where: { token },
            include: { user: true },
        });
    }
    async deleteRefreshToken(token) {
        await prisma.refreshToken.deleteMany({
            where: { token },
        });
    }
    async deleteAllUserRefreshTokens(userId) {
        await prisma.refreshToken.deleteMany({
            where: { userId },
        });
    }
}
//# sourceMappingURL=auth.repository.js.map