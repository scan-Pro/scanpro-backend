import { prisma } from '../../../config/database.js';
import { Folder, Prisma } from '@prisma/client';
import { ForbiddenError, NotFoundError } from '../../../common/errors/app-error.js';

async function lockActiveUser(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  const users = await tx.$queryRaw<Array<{ id: string; lifecycle_status: string }>>`
    SELECT id, lifecycle_status FROM users WHERE id = ${userId} FOR UPDATE
  `;
  if (!users.length) throw new NotFoundError('User not found', 'USER_NOT_FOUND');
  if (users[0].lifecycle_status !== 'ACTIVE') {
    throw new ForbiddenError('Account deletion is in progress', 'ACCOUNT_DELETING');
  }
}

export class FoldersRepository {
  async createFolder(userId: string, name: string, id?: string): Promise<Folder> {
    return prisma.$transaction(async (tx) => {
      await lockActiveUser(tx, userId);
      return tx.folder.create({
        data: { ...(id ? { id } : {}), userId, name },
      });
    });
  }

  async findUserFolders(userId: string): Promise<(Folder & { _count: { documents: number } })[]> {
    return prisma.folder.findMany({
      where: { userId },
      include: { _count: { select: { documents: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string, userId: string): Promise<Folder | null> {
    return prisma.folder.findFirst({ where: { id, userId } });
  }

  async findByName(userId: string, name: string): Promise<Folder | null> {
    return prisma.folder.findFirst({ where: { userId, name } });
  }

  async updateFolder(id: string, userId: string, name: string): Promise<Folder> {
    return prisma.$transaction(async (tx) => {
      await lockActiveUser(tx, userId);
      const { count } = await tx.folder.updateMany({
        where: { id, userId },
        data: { name },
      });
      if (count === 0) throw new NotFoundError('Folder not found', 'FOLDER_NOT_FOUND');
      return tx.folder.findFirstOrThrow({ where: { id, userId } });
    });
  }

  async deleteFolder(id: string, userId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await lockActiveUser(tx, userId);
      const { count } = await tx.folder.deleteMany({ where: { id, userId } });
      if (count === 0) throw new NotFoundError('Folder not found', 'FOLDER_NOT_FOUND');
    });
  }
}
