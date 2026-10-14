import { Prisma, User, UserLifecycleStatus } from '@prisma/client';
import { prisma } from '../../../config/database.js';
import { ForbiddenError } from '../../../common/errors/app-error.js';

export async function lockActiveUser(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<{ id: string; lifecycle_status: UserLifecycleStatus }[]>`
    SELECT id, lifecycle_status FROM users WHERE id = ${userId} FOR UPDATE
  `;
  if (rows.length !== 1 || rows[0].lifecycle_status !== UserLifecycleStatus.ACTIVE) {
    throw new ForbiddenError('Account deletion is in progress', 'ACCOUNT_DELETING');
  }
}

export class UsersRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async updateProfile(id: string, data: { name?: string; passwordHash?: string }): Promise<User> {
    return prisma.user.update({ where: { id }, data });
  }

  async requestAccountDeletion(id: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string; lifecycle_status: UserLifecycleStatus }[]>`
        SELECT id, lifecycle_status FROM users WHERE id = ${id} FOR UPDATE
      `;
      if (rows.length !== 1) return;
      if (rows[0].lifecycle_status === UserLifecycleStatus.ACTIVE) {
        await tx.user.update({
          where: { id },
          data: { lifecycleStatus: UserLifecycleStatus.DELETING },
        });
      }
      await tx.accountDeletionJob.upsert({
        where: { userId: id },
        create: { userId: id },
        update: { status: 'PENDING', lastError: null },
      });
    });
  }

  async finalizeAccountDeletion(id: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.user.deleteMany({
        where: { id, lifecycleStatus: UserLifecycleStatus.DELETING },
      });
    });
  }
}
