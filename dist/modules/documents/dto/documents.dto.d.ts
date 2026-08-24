import { FilterType, SyncStatus } from '@prisma/client';
export interface CreateDocumentPageDto {
    id?: string;
    pageOrder: number;
    imageUrl: string;
    thumbnailUrl?: string;
    filter?: FilterType;
    rotation?: number;
}
export interface CreateDocumentDto {
    id?: string;
    title: string;
    folderId?: string;
    thumbnailUrl?: string;
    pdfUrl?: string;
    pageCount?: number;
    isFavorite?: boolean;
    syncStatus?: SyncStatus;
    pages?: CreateDocumentPageDto[];
}
export interface UpdateDocumentDto {
    title?: string;
    folderId?: string | null;
    thumbnailUrl?: string;
    pdfUrl?: string;
    pageCount?: number;
    isFavorite?: boolean;
}
export interface SyncDocumentItemDto {
    id: string;
    title: string;
    folderId?: string | null;
    thumbnailUrl?: string;
    pdfUrl?: string;
    pageCount: number;
    isFavorite: boolean;
    createdAt: string;
    updatedAt: string;
    pages: {
        id: string;
        pageOrder: number;
        imageUrl: string;
        thumbnailUrl?: string;
        filter: FilterType;
        rotation: number;
    }[];
}
export interface BatchSyncDocumentsDto {
    documents: SyncDocumentItemDto[];
}
