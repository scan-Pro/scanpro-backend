import bcrypt from 'bcrypt';
import { UsersRepository } from '../repository/users.repository.js';
import { UpdateProfileDto, ChangePasswordDto } from '../dto/users.dto.js';
import { NotFoundError, UnauthorizedError } from '../../../common/errors/app-error.js';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UsersService {
  constructor(private readonly usersRepository: UsersRepository = new UsersRepository()) {}

  async getProfile(userId: string): Promise<UserProfile> {
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

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfile> {
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

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
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

  async deleteAccount(userId: string): Promise<void> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    await this.usersRepository.deleteUser(userId);
  }
}
