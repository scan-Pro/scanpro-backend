import { Folder } from '@prisma/client';
export declare class FoldersRepository {
    createFolder(userId: string, name: string): Promise<Folder>;
    findUserFolders(userId: string): Promise<(Folder & {
        _count: {
            documents: number;
        };
    })[]>;
    findById(id: string, userId: string): Promise<Folder | null>;
    findByName(userId: string, name: string): Promise<Folder | null>;
    updateFolder(id: string, userId: string, name: string): Promise<Folder>;
    deleteFolder(id: string, userId: string): Promise<void>;
}
