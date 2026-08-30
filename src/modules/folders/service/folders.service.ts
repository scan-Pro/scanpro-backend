import { FoldersRepository } from '../repository/folders.repository.js';
import { CreateFolderDto, UpdateFolderDto } from '../dto/folders.dto.js';
import { ConflictError, NotFoundError } from '../../../common/errors/app-error.js';
import { Folder } from '@prisma/client';

export class FoldersService {
  constructor(private readonly foldersRepository: FoldersRepository = new FoldersRepository()) {}

  async createFolder(userId: string, dto: CreateFolderDto): Promise<Folder> {
    const trimmedName = dto.name.trim();
    const existing = await this.foldersRepository.findByName(userId, trimmedName);
    if (existing) {
      return existing;
    }

    if (dto.id) {
      const existingById = await this.foldersRepository.findById(dto.id, userId);
      if (existingById) {
        return existingById;
      }
    }

    return this.foldersRepository.createFolder(userId, trimmedName, dto.id);
  }

  async getFolders(userId: string) {
    return this.foldersRepository.findUserFolders(userId);
  }

  async getFolderById(id: string, userId: string): Promise<Folder> {
    const folder = await this.foldersRepository.findById(id, userId);
    if (!folder) {
      throw new NotFoundError('Folder not found', 'FOLDER_NOT_FOUND');
    }
    return folder;
  }

  async updateFolder(id: string, userId: string, dto: UpdateFolderDto): Promise<Folder> {
    const folder = await this.getFolderById(id, userId);

    const trimmedName = dto.name.trim();
    if (trimmedName !== folder.name) {
      const existing = await this.foldersRepository.findByName(userId, trimmedName);
      if (existing && existing.id !== id) {
        throw new ConflictError('A folder with this name already exists', 'FOLDER_ALREADY_EXISTS');
      }
    }

    return this.foldersRepository.updateFolder(id, userId, trimmedName);
  }

  async deleteFolder(id: string, userId: string): Promise<void> {
    await this.getFolderById(id, userId);
    await this.foldersRepository.deleteFolder(id, userId);
  }
}
