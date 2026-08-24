import { z } from 'zod';
export declare const updateProfileSchema: z.ZodObject<{
    body: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
    }, {
        name?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        name?: string | undefined;
    };
}, {
    body: {
        name?: string | undefined;
    };
}>;
export declare const changePasswordSchema: z.ZodObject<{
    body: z.ZodObject<{
        currentPassword: z.ZodString;
        newPassword: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        currentPassword: string;
        newPassword: string;
    }, {
        currentPassword: string;
        newPassword: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        currentPassword: string;
        newPassword: string;
    };
}, {
    body: {
        currentPassword: string;
        newPassword: string;
    };
}>;
