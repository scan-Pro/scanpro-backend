import { prisma } from '../../../config/database.js';
import { Folder } from '@prisma/client';

export class FoldersRepository {
  async createFolder(userId: string, name: string): Promise<Folder> {
    return prisma.folder.create({
      data: {
        userId,
        name,
      },
    });
  }

  async findUserFolders(userId: string): Promise<(Folder & { _count: { documents: number } })[]> {
    return prisma.folder.findMany({
      where: { userId },
      include: {
        _count: {
          select: { documents: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string, userId: string): Promise<Folder | null> {
    return prisma.folder.findFirst({
      where: { id, userId },
    });
  }

  async findByName(userId: string, name: string): Promise<Folder | null> {
    return prisma.folder.findFirst({
      where: { userId, name },
    });
  }

  async updateFolder(id: string, userId: string, name: string): Promise<Folder> {
    return prisma.folder.update({
      where: { id },
      data: { name },
    });
  }

  async deleteFolder(id: string, userId: string): Promise<void> {
    await prisma.folder.delete({
      where: { id },
    });
  }
}
