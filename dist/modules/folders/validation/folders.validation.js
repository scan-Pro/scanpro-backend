import { z } from 'zod';
export const createFolderSchema = z.object({
    body: z.object({
        id: z.string().uuid('Invalid folder ID format').optional(),
        name: z
            .string({ required_error: 'Folder name is required' })
            .trim()
            .min(1, 'Folder name cannot be empty')
            .max(50, 'Folder name cannot exceed 50 characters'),
    }),
});
export const updateFolderSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid folder ID format'),
    }),
    body: z.object({
        name: z
            .string({ required_error: 'Folder name is required' })
            .trim()
            .min(1, 'Folder name cannot be empty')
            .max(50, 'Folder name cannot exceed 50 characters'),
    }),
});
export const folderIdParamSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid folder ID format'),
    }),
});
//# sourceMappingURL=folders.validation.js.map