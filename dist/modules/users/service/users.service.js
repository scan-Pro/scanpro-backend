import bcrypt from 'bcrypt';
import { UsersRepository } from '../repository/users.repository.js';
import { NotFoundError, UnauthorizedError } from '../../../common/errors/app-error.js';
export class UsersService {
    usersRepository;
    constructor(usersRepository = new UsersRepository()) {
        this.usersRepository = usersRepository;
    }
    async getProfile(userId) {
        const user = await this.usersRepository.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found', 'USER_NOT_FOUND');
        }
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }
    async updateProfile(userId, dto) {
        const user = await this.usersRepository.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found', 'USER_NOT_FOUND');
        }
        const updated = await this.usersRepository.updateProfile(userId, {
            name: dto.name?.trim(),
        });
        return {
            id: updated.id,
            name: updated.name,
            email: updated.email,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
        };
    }
    async changePassword(userId, dto) {
        const user = await this.usersRepository.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found', 'USER_NOT_FOUND');
        }
        const isValidPassword = await bcrypt.compare(dto.currentPassword, user.passwordHash);
        if (!isValidPassword) {
            throw new UnauthorizedError('Current password does not match', 'INVALID_CURRENT_PASSWORD');
        }
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(dto.newPassword, saltRounds);
        await this.usersRepository.updateProfile(userId, { passwordHash });
    }
    async deleteAccount(userId) {
        const user = await this.usersRepository.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found', 'USER_NOT_FOUND');
        }
        await this.usersRepository.deleteUser(userId);
    }
}
//# sourceMappingURL=users.service.js.map