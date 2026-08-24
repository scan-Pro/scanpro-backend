import { FoldersRepository } from '../repository/folders.repository.js';
import { ConflictError, NotFoundError } from '../../../common/errors/app-error.js';
export class FoldersService {
    foldersRepository;
    constructor(foldersRepository = new FoldersRepository()) {
        this.foldersRepository = foldersRepository;
    }
    async createFolder(userId, dto) {
        const trimmedName = dto.name.trim();
        const existing = await this.foldersRepository.findByName(userId, trimmedName);
        if (existing) {
            throw new ConflictError('A folder with this name already exists', 'FOLDER_ALREADY_EXISTS');
        }
        return this.foldersRepository.createFolder(userId, trimmedName);
    }
    async getFolders(userId) {
        return this.foldersRepository.findUserFolders(userId);
    }
    async getFolderById(id, userId) {
        const folder = await this.foldersRepository.findById(id, userId);
        if (!folder) {
            throw new NotFoundError('Folder not found', 'FOLDER_NOT_FOUND');
        }
        return folder;
    }
    async updateFolder(id, userId, dto) {
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
    async deleteFolder(id, userId) {
        await this.getFolderById(id, userId);
        await this.foldersRepository.deleteFolder(id, userId);
    }
}
//# sourceMappingURL=folders.service.js.map