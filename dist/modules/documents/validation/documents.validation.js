import { z } from 'zod';
const filterTypeEnum = z.enum(['ORIGINAL', 'AUTO', 'MAGIC_COLOR', 'GRAYSCALE', 'BLACK_AND_WHITE']);
export const createDocumentPageSchema = z.object({
    id: z.string().uuid().optional(),
    pageOrder: z.number().int().min(0),
    imageUrl: z.string().min(1, 'Image URL cannot be empty'),
    thumbnailUrl: z.string().optional(),
    filter: filterTypeEnum.optional().default('ORIGINAL'),
    rotation: z.number().int().optional().default(0),
});
export const createDocumentSchema = z.object({
    body: z.object({
        id: z.string().uuid().optional(),
        title: z.string({ required_error: 'Title is required' }).trim().min(1, 'Title cannot be empty').max(255),
        folderId: z.string().uuid().optional().nullable(),
        thumbnailUrl: z.string().optional().nullable(),
        pdfUrl: z.string().optional().nullable(),
        pageCount: z.number().int().min(1).optional().default(1),
        isFavorite: z.boolean().optional().default(false),
        pages: z.array(createDocumentPageSchema).optional(),
    }),
});
export const updateDocumentSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid document ID format'),
    }),
    body: z.object({
        title: z.string().trim().min(1, 'Title cannot be empty').max(255).optional(),
        folderId: z.string().uuid().optional().nullable(),
        thumbnailUrl: z.string().optional().nullable(),
        pdfUrl: z.string().optional().nullable(),
        pageCount: z.number().int().min(1).optional(),
        isFavorite: z.boolean().optional(),
    }),
});
export const documentIdParamSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid document ID format'),
    }),
});
export const favoriteToggleSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid document ID format'),
    }),
    body: z.object({
        isFavorite: z.boolean({ required_error: 'isFavorite is required' }),
    }),
});
export const moveFolderSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid document ID format'),
    }),
    body: z.object({
        folderId: z.string().uuid().nullable(),
    }),
});
export const searchDocumentsSchema = z.object({
    query: z.object({
        q: z.string().optional().default(''),
        folderId: z.string().uuid().optional(),
        favorite: z.enum(['true', 'false']).optional(),
    }),
});
//# sourceMappingURL=documents.validation.js.map