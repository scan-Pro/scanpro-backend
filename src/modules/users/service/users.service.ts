import bcrypt from 'bcrypt';
import { UsersRepository } from '../repository/users.repository.js';
import { UpdateProfileDto, ChangePasswordDto } from '../dto/users.dto.js';
import { NotFoundError, UnauthorizedError } from '../../../common/errors/app-error.js';
import { AuthRepository } from '../../auth/repository/auth.repository.js';
import { AccountDeletionService } from './account-deletion.service.js';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository = new UsersRepository(),
    private readonly authRepository: AuthRepository = new AuthRepository(),
    private readonly accountDeletionService: AccountDeletionService = new AccountDeletionService(),
  ) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    if (user.lifecycleStatus !== 'ACTIVE') {
      throw new NotFoundError('User account is being deleted', 'USER_DELETING');
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfile> {
    const updated = await this.usersRepository.updateProfileIfActive(userId, {
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

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.usersRepository.findActiveById(userId);
    if (!user) {
      throw new NotFoundError('User not found or account is being deleted', 'USER_NOT_ACTIVE');
    }
    const isValidPassword = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedError('Current password does not match', 'INVALID_CURRENT_PASSWORD');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.usersRepository.updateProfileIfActive(userId, { passwordHash });
    await this.authRepository.deleteAllUserRefreshTokens(userId);
  }

  async deleteAccount(userId: string): Promise<
    | { status: 'DELETING'; jobId: string }
    | { status: 'COMPLETED'; jobId?: string; completedAt: Date }
  > {
    return this.accountDeletionService.requestDeletion(userId);
  }
}
