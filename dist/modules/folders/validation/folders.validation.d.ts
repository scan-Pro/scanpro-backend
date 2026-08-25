import { z } from 'zod';
export declare const createFolderSchema: z.ZodObject<{
    body: z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id?: string | undefined;
    }, {
        name: string;
        id?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        name: string;
        id?: string | undefined;
    };
}, {
    body: {
        name: string;
        id?: string | undefined;
    };
}>;
export declare const updateFolderSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
    }, {
        name: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
    body: {
        name: string;
    };
}, {
    params: {
        id: string;
    };
    body: {
        name: string;
    };
}>;
export declare const folderIdParamSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
}, {
    params: {
        id: string;
    };
}>;
