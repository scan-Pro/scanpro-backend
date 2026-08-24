import { z } from 'zod';
export const updateProfileSchema = z.object({
    body: z.object({
        name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    }),
});
export const changePasswordSchema = z.object({
    body: z.object({
        currentPassword: z.string({ required_error: 'Current password is required' }).min(1, 'Current password cannot be empty'),
        newPassword: z.string({ required_error: 'New password is required' }).min(8, 'New password must be at least 8 characters'),
    }),
});
//# sourceMappingURL=users.validation.js.map