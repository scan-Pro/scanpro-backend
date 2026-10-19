import { prisma } from '../../../config/database.js';
import { User } from '@prisma/client';
import { assertUserActive } from '../../../common/utils/account-lifecycle.util.js';

export class UsersRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async findActiveById(id: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { id, lifecycleStatus: 'ACTIVE' } });
  }

  async updateProfileIfActive(
    id: string,
    data: { name?: string; passwordHash?: string },
  ): Promise<User> {
    return prisma.$transaction(async (tx) => {
      await assertUserActive(tx, id);
      return tx.user.update({ where: { id }, data });
    });
  }

  /** Immediate hard deletion is intentionally not exposed from this repository. */
  async deleteUser(id: string): Promise<void> {
    throw new Error('Immediate account deletion is disabled; use AccountDeletionService');
  }
}
