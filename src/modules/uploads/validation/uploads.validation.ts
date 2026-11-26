import { z } from 'zod';

export const getPresignedUrlSchema = z.object({
  body: z.object({
    fileName: z.string({ required_error: 'File name is required' }).min(1).max(255),
    fileType: z
      .string({ required_error: 'File type is required' })
      .regex(/^(image\/(jpeg|png|webp)|application\/pdf)$/, 'Unsupported file type. Only JPEG, PNG, WEBP, and PDF allowed'),
    // Folder is a controlled namespace segment, not an arbitrary object-key prefix.
    folder: z.enum(['documents', 'pages', 'thumbnails', 'pdfs']).optional().default('documents'),
  }),
});
