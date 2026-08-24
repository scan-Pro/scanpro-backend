import { prisma } from '../../../config/database.js';
import { User } from '@prisma/client';

export class UsersRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async updateProfile(id: string, data: { name?: string; passwordHash?: string }): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  async deleteUser(id: string): Promise<void> {
    await prisma.user.delete({
      where: { id },
    });
  }
}
