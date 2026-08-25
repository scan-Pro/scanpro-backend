import { z } from 'zod';
export declare const createDocumentPageSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    pageOrder: z.ZodNumber;
    imageUrl: z.ZodString;
    thumbnailUrl: z.ZodOptional<z.ZodString>;
    filter: z.ZodDefault<z.ZodOptional<z.ZodEnum<["ORIGINAL", "AUTO", "MAGIC_COLOR", "GRAYSCALE", "BLACK_AND_WHITE"]>>>;
    rotation: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    filter: "ORIGINAL" | "MAGIC_COLOR" | "GRAYSCALE" | "AUTO" | "BLACK_AND_WHITE";
    pageOrder: number;
    imageUrl: string;
    rotation: number;
    id?: string | undefined;
    thumbnailUrl?: string | undefined;
}, {
    pageOrder: number;
    imageUrl: string;
    filter?: "ORIGINAL" | "MAGIC_COLOR" | "GRAYSCALE" | "AUTO" | "BLACK_AND_WHITE" | undefined;
    id?: string | undefined;
    thumbnailUrl?: string | undefined;
    rotation?: number | undefined;
}>;
export declare const createDocumentSchema: z.ZodObject<{
    body: z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        title: z.ZodString;
        folderId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        thumbnailUrl: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        pdfUrl: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        pageCount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        isFavorite: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        pages: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            pageOrder: z.ZodNumber;
            imageUrl: z.ZodString;
            thumbnailUrl: z.ZodOptional<z.ZodString>;
            filter: z.ZodDefault<z.ZodOptional<z.ZodEnum<["ORIGINAL", "AUTO", "MAGIC_COLOR", "GRAYSCALE", "BLACK_AND_WHITE"]>>>;
            rotation: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        }, "strip", z.ZodTypeAny, {
            filter: "ORIGINAL" | "MAGIC_COLOR" | "GRAYSCALE" | "AUTO" | "BLACK_AND_WHITE";
            pageOrder: number;
            imageUrl: string;
            rotation: number;
            id?: string | undefined;
            thumbnailUrl?: string | undefined;
        }, {
            pageOrder: number;
            imageUrl: string;
            filter?: "ORIGINAL" | "MAGIC_COLOR" | "GRAYSCALE" | "AUTO" | "BLACK_AND_WHITE" | undefined;
            id?: string | undefined;
            thumbnailUrl?: string | undefined;
            rotation?: number | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        isFavorite: boolean;
        pageCount: number;
        pages?: {
            filter: "ORIGINAL" | "MAGIC_COLOR" | "GRAYSCALE" | "AUTO" | "BLACK_AND_WHITE";
            pageOrder: number;
            imageUrl: string;
            rotation: number;
            id?: string | undefined;
            thumbnailUrl?: string | undefined;
        }[] | undefined;
        id?: string | undefined;
        folderId?: string | null | undefined;
        thumbnailUrl?: string | null | undefined;
        pdfUrl?: string | null | undefined;
    }, {
        title: string;
        isFavorite?: boolean | undefined;
        pages?: {
            pageOrder: number;
            imageUrl: string;
            filter?: "ORIGINAL" | "MAGIC_COLOR" | "GRAYSCALE" | "AUTO" | "BLACK_AND_WHITE" | undefined;
            id?: string | undefined;
            thumbnailUrl?: string | undefined;
            rotation?: number | undefined;
        }[] | undefined;
        id?: string | undefined;
        folderId?: string | null | undefined;
        thumbnailUrl?: string | null | undefined;
        pdfUrl?: string | null | undefined;
        pageCount?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        title: string;
        isFavorite: boolean;
        pageCount: number;
        pages?: {
            filter: "ORIGINAL" | "MAGIC_COLOR" | "GRAYSCALE" | "AUTO" | "BLACK_AND_WHITE";
            pageOrder: number;
            imageUrl: string;
            rotation: number;
            id?: string | undefined;
            thumbnailUrl?: string | undefined;
        }[] | undefined;
        id?: string | undefined;
        folderId?: string | null | undefined;
        thumbnailUrl?: string | null | undefined;
        pdfUrl?: string | null | undefined;
    };
}, {
    body: {
        title: string;
        isFavorite?: boolean | undefined;
        pages?: {
            pageOrder: number;
            imageUrl: string;
            filter?: "ORIGINAL" | "MAGIC_COLOR" | "GRAYSCALE" | "AUTO" | "BLACK_AND_WHITE" | undefined;
            id?: string | undefined;
            thumbnailUrl?: string | undefined;
            rotation?: number | undefined;
        }[] | undefined;
        id?: string | undefined;
        folderId?: string | null | undefined;
        thumbnailUrl?: string | null | undefined;
        pdfUrl?: string | null | undefined;
        pageCount?: number | undefined;
    };
}>;
export declare const updateDocumentSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        title: z.ZodOptional<z.ZodString>;
        folderId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        thumbnailUrl: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        pdfUrl: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        pageCount: z.ZodOptional<z.ZodNumber>;
        isFavorite: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        title?: string | undefined;
        isFavorite?: boolean | undefined;
        folderId?: string | null | undefined;
        thumbnailUrl?: string | null | undefined;
        pdfUrl?: string | null | undefined;
        pageCount?: number | undefined;
    }, {
        title?: string | undefined;
        isFavorite?: boolean | undefined;
        folderId?: string | null | undefined;
        thumbnailUrl?: string | null | undefined;
        pdfUrl?: string | null | undefined;
        pageCount?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
    body: {
        title?: string | undefined;
        isFavorite?: boolean | undefined;
        folderId?: string | null | undefined;
        thumbnailUrl?: string | null | undefined;
        pdfUrl?: string | null | undefined;
        pageCount?: number | undefined;
    };
}, {
    params: {
        id: string;
    };
    body: {
        title?: string | undefined;
        isFavorite?: boolean | undefined;
        folderId?: string | null | undefined;
        thumbnailUrl?: string | null | undefined;
        pdfUrl?: string | null | undefined;
        pageCount?: number | undefined;
    };
}>;
export declare const documentIdParamSchema: z.ZodObject<{
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
export declare const favoriteToggleSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        isFavorite: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        isFavorite: boolean;
    }, {
        isFavorite: boolean;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
    body: {
        isFavorite: boolean;
    };
}, {
    params: {
        id: string;
    };
    body: {
        isFavorite: boolean;
    };
}>;
export declare const moveFolderSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        folderId: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        folderId: string | null;
    }, {
        folderId: string | null;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
    body: {
        folderId: string | null;
    };
}, {
    params: {
        id: string;
    };
    body: {
        folderId: string | null;
    };
}>;
export declare const searchDocumentsSchema: z.ZodObject<{
    query: z.ZodObject<{
        q: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        folderId: z.ZodOptional<z.ZodString>;
        favorite: z.ZodOptional<z.ZodEnum<["true", "false"]>>;
    }, "strip", z.ZodTypeAny, {
        q: string;
        folderId?: string | undefined;
        favorite?: "true" | "false" | undefined;
    }, {
        folderId?: string | undefined;
        q?: string | undefined;
        favorite?: "true" | "false" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        q: string;
        folderId?: string | undefined;
        favorite?: "true" | "false" | undefined;
    };
}, {
    query: {
        folderId?: string | undefined;
        q?: string | undefined;
        favorite?: "true" | "false" | undefined;
    };
}>;
