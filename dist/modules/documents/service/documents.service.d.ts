import { DocumentsRepository, DocumentWithRelations } from '../repository/documents.repository.js';
import { CreateDocumentDto, UpdateDocumentDto } from '../dto/documents.dto.js';
export declare class DocumentsService {
    private readonly documentsRepository;
    constructor(documentsRepository?: DocumentsRepository);
    createDocument(userId: string, dto: CreateDocumentDto): Promise<DocumentWithRelations>;
    getDocuments(userId: string, filters?: {
        q?: string;
        folderId?: string;
        isFavorite?: boolean;
    }): Promise<DocumentWithRelations[]>;
    getDocumentById(id: string, userId: string): Promise<DocumentWithRelations>;
    updateDocument(id: string, userId: string, dto: UpdateDocumentDto): Promise<DocumentWithRelations>;
    deleteDocument(id: string, userId: string): Promise<void>;
    toggleFavorite(id: string, userId: string, isFavorite: boolean): Promise<DocumentWithRelations>;
    moveToFolder(id: string, userId: string, folderId: string | null): Promise<DocumentWithRelations>;
}
