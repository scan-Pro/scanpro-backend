import { FilterType, SyncStatus } from '@prisma/client';

export interface CreateDocumentPageDto {
  id?: string;
  pageOrder: number;
  imageUrl: string;
  thumbnailUrl?: string | null;
  filter?: FilterType;
  rotation?: number;
}

export interface CreateDocumentDto {
  id?: string;
  title: string;
  folderId?: string | null;
  thumbnailUrl?: string | null;
  pdfUrl?: string | null;
  pageCount?: number;
  isFavorite?: boolean;
  syncStatus?: SyncStatus;
  createdAt?: string;
  updatedAt?: string;
  pages?: CreateDocumentPageDto[];
}

export interface UpdateDocumentDto {
  title?: string;
  folderId?: string | null;
  thumbnailUrl?: string | null;
  pdfUrl?: string | null;
  pageCount?: number;
  isFavorite?: boolean;
  pages?: CreateDocumentPageDto[];
}

export interface QueryDocumentsDto {
  q?: string;
  folderId?: string;
  isFavorite?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginationMetaDto {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedDocumentsResult<T> {
  documents: T[];
  pagination: PaginationMetaDto;
}
