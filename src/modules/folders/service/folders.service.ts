import { FoldersRepository } from '../repository/folders.repository.js';
import { CreateFolderDto, UpdateFolderDto } from '../dto/folders.dto.js';
import { ConflictError, NotFoundError } from '../../../common/errors/app-error.js';
import { Folder } from '@prisma/client';

export class FoldersService {
  constructor(private readonly foldersRepository: FoldersRepository = new FoldersRepository()) {}

  async createFolder(userId: string, dto: CreateFolderDto): Promise<Folder> {
    const trimmedName = dto.name.trim();

    if (dto.id) {
      // A client-supplied (offline-generated) id is the source of truth for
      // idempotent retries — check it first rather than matching by name,
      // so a retry always resolves to the exact folder the client expects.
      const existingById = await this.foldersRepository.findById(dto.id, userId);
      if (existingById) {
        return existingById;
      }

      // No folder exists under this id yet. If a *different* folder already
      // owns this name (unique per user), this is a genuine conflict —
      // surface it instead of silently returning that other folder under an
      // id the client never asked for.
      const existingByName = await this.foldersRepository.findByName(userId, trimmedName);
      if (existingByName) {
        throw new ConflictError('A folder with this name already exists', 'FOLDER_ALREADY_EXISTS');
      }

      return this.foldersRepository.createFolder(userId, trimmedName, dto.id);
    }

    // No client-supplied id: fall back to name-based idempotency so retries
    // without an id don't create duplicate folders.
    const existingByName = await this.foldersRepository.findByName(userId, trimmedName);
    if (existingByName) {
      return existingByName;
    }

    return this.foldersRepository.createFolder(userId, trimmedName);
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
