import { FoldersRepository } from '../repository/folders.repository.js';
import { CreateFolderDto, UpdateFolderDto } from '../dto/folders.dto.js';
import { Folder } from '@prisma/client';
export declare class FoldersService {
    private readonly foldersRepository;
    constructor(foldersRepository?: FoldersRepository);
    createFolder(userId: string, dto: CreateFolderDto): Promise<Folder>;
    getFolders(userId: string): Promise<({
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
    } & {
        _count: {
            documents: number;
        };
    })[]>;
    getFolderById(id: string, userId: string): Promise<Folder>;
    updateFolder(id: string, userId: string, dto: UpdateFolderDto): Promise<Folder>;
    deleteFolder(id: string, userId: string): Promise<void>;
}
