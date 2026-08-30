import { DocumentsRepository, DocumentWithRelations } from '../repository/documents.repository.js';
import { CreateDocumentDto, UpdateDocumentDto, QueryDocumentsDto, PaginatedDocumentsResult } from '../dto/documents.dto.js';
import { UploadsService } from '../../uploads/service/uploads.service.js';
import { FoldersRepository } from '../../folders/repository/folders.repository.js';
export declare class DocumentsService {
    private readonly documentsRepository;
    private readonly uploadsService;
    private readonly foldersRepository;
    constructor(documentsRepository?: DocumentsRepository, uploadsService?: UploadsService, foldersRepository?: FoldersRepository);
    createDocument(userId: string, dto: CreateDocumentDto): Promise<DocumentWithRelations>;
    getDocuments(userId: string, filters?: QueryDocumentsDto): Promise<PaginatedDocumentsResult<DocumentWithRelations>>;
    getDocumentById(id: string, userId: string): Promise<DocumentWithRelations>;
    updateDocument(id: string, userId: string, dto: UpdateDocumentDto): Promise<DocumentWithRelations>;
    deleteDocument(id: string, userId: string): Promise<void>;
    toggleFavorite(id: string, userId: string, isFavorite: boolean): Promise<DocumentWithRelations>;
    moveToFolder(id: string, userId: string, folderId: string | null): Promise<DocumentWithRelations>;
}
