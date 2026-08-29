import { Document, DocumentPage } from '@prisma/client';
import { CreateDocumentDto, UpdateDocumentDto, QueryDocumentsDto } from '../dto/documents.dto.js';
export type DocumentWithRelations = Document & {
    folder: {
        id: string;
        name: string;
    } | null;
    pages: DocumentPage[];
};
export declare class DocumentsRepository {
    createDocument(userId: string, data: CreateDocumentDto): Promise<DocumentWithRelations>;
    findUserDocuments(userId: string, filters?: QueryDocumentsDto): Promise<{
        documents: DocumentWithRelations[];
        totalCount: number;
    }>;
    findById(id: string, userId: string): Promise<DocumentWithRelations | null>;
    updateDocument(id: string, userId: string, data: UpdateDocumentDto): Promise<DocumentWithRelations>;
    deleteDocument(id: string, userId: string): Promise<void>;
    toggleFavorite(id: string, userId: string, isFavorite: boolean): Promise<DocumentWithRelations>;
    moveToFolder(id: string, userId: string, folderId: string | null): Promise<DocumentWithRelations>;
}
