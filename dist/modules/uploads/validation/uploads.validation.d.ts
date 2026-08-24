import { z } from 'zod';
export declare const getPresignedUrlSchema: z.ZodObject<{
    body: z.ZodObject<{
        fileName: z.ZodString;
        fileType: z.ZodString;
        folder: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        folder: string;
        fileName: string;
        fileType: string;
    }, {
        fileName: string;
        fileType: string;
        folder?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        folder: string;
        fileName: string;
        fileType: string;
    };
}, {
    body: {
        fileName: string;
        fileType: string;
        folder?: string | undefined;
    };
}>;
