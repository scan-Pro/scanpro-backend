import { Express } from 'express';
export declare const swaggerSpec: {
    openapi: string;
    info: {
        title: string;
        version: string;
        description: string;
        contact: {
            name: string;
            email: string;
        };
        license: {
            name: string;
        };
    };
    servers: {
        url: string;
        description: string;
    }[];
    tags: {
        name: string;
        description: string;
    }[];
    components: {
        securitySchemes: {
            bearerAuth: {
                type: string;
                scheme: string;
                bearerFormat: string;
                description: string;
            };
        };
        schemas: {
            SuccessResponse: {
                type: string;
                properties: {
                    success: {
                        type: string;
                        example: boolean;
                    };
                    message: {
                        type: string;
                        example: string;
                    };
                    data: {
                        type: string;
                    };
                };
            };
            ErrorResponse: {
                type: string;
                properties: {
                    success: {
                        type: string;
                        example: boolean;
                    };
                    message: {
                        type: string;
                        example: string;
                    };
                    error: {
                        type: string;
                        properties: {
                            code: {
                                type: string;
                                example: string;
                            };
                            details: {
                                type: string;
                            };
                        };
                    };
                };
            };
            User: {
                type: string;
                properties: {
                    id: {
                        type: string;
                        format: string;
                        example: string;
                    };
                    email: {
                        type: string;
                        format: string;
                        example: string;
                    };
                    name: {
                        type: string;
                        example: string;
                    };
                    avatarUrl: {
                        type: string;
                        nullable: boolean;
                        example: string;
                    };
                    createdAt: {
                        type: string;
                        format: string;
                    };
                    updatedAt: {
                        type: string;
                        format: string;
                    };
                };
            };
            AuthTokens: {
                type: string;
                properties: {
                    accessToken: {
                        type: string;
                        example: string;
                    };
                    refreshToken: {
                        type: string;
                        example: string;
                    };
                    expiresIn: {
                        type: string;
                        example: string;
                    };
                };
            };
            AuthResponseData: {
                type: string;
                properties: {
                    user: {
                        $ref: string;
                    };
                    tokens: {
                        $ref: string;
                    };
                };
            };
            Folder: {
                type: string;
                properties: {
                    id: {
                        type: string;
                        format: string;
                        example: string;
                    };
                    name: {
                        type: string;
                        example: string;
                    };
                    userId: {
                        type: string;
                        format: string;
                    };
                    documentCount: {
                        type: string;
                        example: number;
                    };
                    createdAt: {
                        type: string;
                        format: string;
                    };
                    updatedAt: {
                        type: string;
                        format: string;
                    };
                };
            };
            DocumentPage: {
                type: string;
                properties: {
                    id: {
                        type: string;
                        format: string;
                        example: string;
                    };
                    documentId: {
                        type: string;
                        format: string;
                    };
                    pageOrder: {
                        type: string;
                        example: number;
                    };
                    localPath: {
                        type: string;
                        nullable: boolean;
                        example: string;
                    };
                    remoteUrl: {
                        type: string;
                        nullable: boolean;
                        example: string;
                    };
                    thumbnailUrl: {
                        type: string;
                        nullable: boolean;
                        example: string;
                    };
                    filter: {
                        type: string;
                        enum: string[];
                        example: string;
                    };
                    rotation: {
                        type: string;
                        example: number;
                    };
                    createdAt: {
                        type: string;
                        format: string;
                    };
                };
            };
            Document: {
                type: string;
                properties: {
                    id: {
                        type: string;
                        format: string;
                        example: string;
                    };
                    userId: {
                        type: string;
                        format: string;
                    };
                    folderId: {
                        type: string;
                        format: string;
                        nullable: boolean;
                        example: string;
                    };
                    title: {
                        type: string;
                        example: string;
                    };
                    thumbnailUrl: {
                        type: string;
                        nullable: boolean;
                        example: string;
                    };
                    pdfUrl: {
                        type: string;
                        nullable: boolean;
                        example: string;
                    };
                    pageCount: {
                        type: string;
                        example: number;
                    };
                    isFavorite: {
                        type: string;
                        example: boolean;
                    };
                    createdAt: {
                        type: string;
                        format: string;
                    };
                    updatedAt: {
                        type: string;
                        format: string;
                    };
                    pages: {
                        type: string;
                        items: {
                            $ref: string;
                        };
                    };
                    folder: {
                        $ref: string;
                    };
                };
            };
            RegisterDto: {
                type: string;
                required: string[];
                properties: {
                    name: {
                        type: string;
                        minLength: number;
                        maxLength: number;
                        example: string;
                    };
                    email: {
                        type: string;
                        format: string;
                        example: string;
                    };
                    password: {
                        type: string;
                        minLength: number;
                        maxLength: number;
                        example: string;
                    };
                };
            };
            LoginDto: {
                type: string;
                required: string[];
                properties: {
                    email: {
                        type: string;
                        format: string;
                        example: string;
                    };
                    password: {
                        type: string;
                        example: string;
                    };
                };
            };
            RefreshTokenDto: {
                type: string;
                required: string[];
                properties: {
                    refreshToken: {
                        type: string;
                        example: string;
                    };
                };
            };
            CreateFolderDto: {
                type: string;
                required: string[];
                properties: {
                    name: {
                        type: string;
                        minLength: number;
                        maxLength: number;
                        example: string;
                    };
                };
            };
            UpdateFolderDto: {
                type: string;
                required: string[];
                properties: {
                    name: {
                        type: string;
                        minLength: number;
                        maxLength: number;
                        example: string;
                    };
                };
            };
            CreateDocumentPageDto: {
                type: string;
                required: string[];
                properties: {
                    pageOrder: {
                        type: string;
                        example: number;
                    };
                    remoteUrl: {
                        type: string;
                        nullable: boolean;
                        example: string;
                    };
                    thumbnailUrl: {
                        type: string;
                        nullable: boolean;
                        example: string;
                    };
                    filter: {
                        type: string;
                        enum: string[];
                        default: string;
                    };
                    rotation: {
                        type: string;
                        default: number;
                        example: number;
                    };
                };
            };
            CreateDocumentDto: {
                type: string;
                required: string[];
                properties: {
                    id: {
                        type: string;
                        format: string;
                        description: string;
                        example: string;
                    };
                    title: {
                        type: string;
                        minLength: number;
                        maxLength: number;
                        example: string;
                    };
                    folderId: {
                        type: string;
                        format: string;
                        nullable: boolean;
                        example: string;
                    };
                    thumbnailUrl: {
                        type: string;
                        nullable: boolean;
                        example: string;
                    };
                    pdfUrl: {
                        type: string;
                        nullable: boolean;
                        example: string;
                    };
                    pageCount: {
                        type: string;
                        example: number;
                    };
                    isFavorite: {
                        type: string;
                        default: boolean;
                    };
                    pages: {
                        type: string;
                        items: {
                            $ref: string;
                        };
                    };
                };
            };
            UpdateDocumentDto: {
                type: string;
                properties: {
                    title: {
                        type: string;
                        minLength: number;
                        maxLength: number;
                        example: string;
                    };
                    folderId: {
                        type: string;
                        format: string;
                        nullable: boolean;
                    };
                    thumbnailUrl: {
                        type: string;
                        nullable: boolean;
                    };
                    pdfUrl: {
                        type: string;
                        nullable: boolean;
                    };
                    isFavorite: {
                        type: string;
                    };
                };
            };
            ToggleFavoriteDto: {
                type: string;
                required: string[];
                properties: {
                    isFavorite: {
                        type: string;
                        example: boolean;
                    };
                };
            };
            MoveFolderDto: {
                type: string;
                properties: {
                    folderId: {
                        type: string;
                        format: string;
                        nullable: boolean;
                        example: string;
                    };
                };
            };
            GetPresignedUrlDto: {
                type: string;
                required: string[];
                properties: {
                    fileName: {
                        type: string;
                        example: string;
                    };
                    fileType: {
                        type: string;
                        example: string;
                    };
                    folder: {
                        type: string;
                        enum: string[];
                        example: string;
                    };
                };
            };
        };
    };
    paths: {
        '/health': {
            get: {
                tags: string[];
                summary: string;
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        success: {
                                            type: string;
                                            example: boolean;
                                        };
                                        message: {
                                            type: string;
                                            example: string;
                                        };
                                        data: {
                                            type: string;
                                            properties: {
                                                status: {
                                                    type: string;
                                                    example: string;
                                                };
                                                timestamp: {
                                                    type: string;
                                                    format: string;
                                                };
                                                version: {
                                                    type: string;
                                                    example: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/auth/register': {
            post: {
                tags: string[];
                summary: string;
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    201: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        success: {
                                            type: string;
                                            example: boolean;
                                        };
                                        message: {
                                            type: string;
                                            example: string;
                                        };
                                        data: {
                                            $ref: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                    400: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                    409: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/auth/login': {
            post: {
                tags: string[];
                summary: string;
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        success: {
                                            type: string;
                                            example: boolean;
                                        };
                                        message: {
                                            type: string;
                                            example: string;
                                        };
                                        data: {
                                            $ref: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                    401: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/auth/refresh': {
            post: {
                tags: string[];
                summary: string;
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        success: {
                                            type: string;
                                            example: boolean;
                                        };
                                        message: {
                                            type: string;
                                            example: string;
                                        };
                                        data: {
                                            type: string;
                                            properties: {
                                                tokens: {
                                                    $ref: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                    401: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/auth/logout': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    bearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        success: {
                                            type: string;
                                            example: boolean;
                                        };
                                        message: {
                                            type: string;
                                            example: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/users/profile': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    bearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        success: {
                                            type: string;
                                            example: boolean;
                                        };
                                        data: {
                                            $ref: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                    401: {
                        description: string;
                    };
                };
            };
            patch: {
                tags: string[];
                summary: string;
                security: {
                    bearerAuth: never[];
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                type: string;
                                properties: {
                                    name: {
                                        type: string;
                                        example: string;
                                    };
                                    avatarUrl: {
                                        type: string;
                                        example: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        success: {
                                            type: string;
                                            example: boolean;
                                        };
                                        data: {
                                            $ref: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/users/change-password': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    bearerAuth: never[];
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                type: string;
                                required: string[];
                                properties: {
                                    currentPassword: {
                                        type: string;
                                        example: string;
                                    };
                                    newPassword: {
                                        type: string;
                                        minLength: number;
                                        example: string;
                                    };
                                };
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        success: {
                                            type: string;
                                            example: boolean;
                                        };
                                        message: {
                                            type: string;
                                            example: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                    400: {
                        description: string;
                    };
                };
            };
        };
        '/folders': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    bearerAuth: never[];
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        success: {
                                            type: string;
                                            example: boolean;
                                        };
                                        data: {
                                            type: string;
                                            items: {
                                                $ref: string;
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
            post: {
                tags: string[];
                summary: string;
                security: {
                    bearerAuth: never[];
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    201: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        success: {
                                            type: string;
                                            example: boolean;
                                        };
                                        message: {
                                            type: string;
                                            example: string;
                                        };
                                        data: {
                                            $ref: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/folders/{id}': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    bearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                        format: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        success: {
                                            type: string;
                                            example: boolean;
                                        };
                                        data: {
                                            $ref: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                    404: {
                        description: string;
                    };
                };
            };
            patch: {
                tags: string[];
                summary: string;
                security: {
                    bearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                        format: string;
                    };
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        success: {
                                            type: string;
                                            example: boolean;
                                        };
                                        data: {
                                            $ref: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
            delete: {
                tags: string[];
                summary: string;
                security: {
                    bearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                        format: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        success: {
                                            type: string;
                                            example: boolean;
                                        };
                                        message: {
                                            type: string;
                                            example: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/documents': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    bearerAuth: never[];
                }[];
                parameters: ({
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        default: number;
                        format?: undefined;
                    };
                    description?: undefined;
                } | {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        default?: undefined;
                        format?: undefined;
                    };
                    description: string;
                } | {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        format: string;
                        default?: undefined;
                    };
                    description: string;
                })[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        success: {
                                            type: string;
                                            example: boolean;
                                        };
                                        data: {
                                            type: string;
                                            properties: {
                                                documents: {
                                                    type: string;
                                                    items: {
                                                        $ref: string;
                                                    };
                                                };
                                                pagination: {
                                                    type: string;
                                                    properties: {
                                                        page: {
                                                            type: string;
                                                            example: number;
                                                        };
                                                        limit: {
                                                            type: string;
                                                            example: number;
                                                        };
                                                        total: {
                                                            type: string;
                                                            example: number;
                                                        };
                                                        totalPages: {
                                                            type: string;
                                                            example: number;
                                                        };
                                                    };
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
            post: {
                tags: string[];
                summary: string;
                security: {
                    bearerAuth: never[];
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    201: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        success: {
                                            type: string;
                                            example: boolean;
                                        };
                                        message: {
                                            type: string;
                                            example: string;
                                        };
                                        data: {
                                            $ref: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/documents/{id}': {
            get: {
                tags: string[];
                summary: string;
                security: {
                    bearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                        format: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        success: {
                                            type: string;
                                            example: boolean;
                                        };
                                        data: {
                                            $ref: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                    404: {
                        description: string;
                    };
                };
            };
            patch: {
                tags: string[];
                summary: string;
                security: {
                    bearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                        format: string;
                    };
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        success: {
                                            type: string;
                                            example: boolean;
                                        };
                                        data: {
                                            $ref: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
            delete: {
                tags: string[];
                summary: string;
                security: {
                    bearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                        format: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        success: {
                                            type: string;
                                            example: boolean;
                                        };
                                        message: {
                                            type: string;
                                            example: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/documents/{id}/favorite': {
            patch: {
                tags: string[];
                summary: string;
                security: {
                    bearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                        format: string;
                    };
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        success: {
                                            type: string;
                                            example: boolean;
                                        };
                                        data: {
                                            $ref: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/documents/{id}/folder': {
            patch: {
                tags: string[];
                summary: string;
                security: {
                    bearerAuth: never[];
                }[];
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                        format: string;
                    };
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        success: {
                                            type: string;
                                            example: boolean;
                                        };
                                        data: {
                                            $ref: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/uploads/presigned-url': {
            post: {
                tags: string[];
                summary: string;
                security: {
                    bearerAuth: never[];
                }[];
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        success: {
                                            type: string;
                                            example: boolean;
                                        };
                                        message: {
                                            type: string;
                                            example: string;
                                        };
                                        data: {
                                            type: string;
                                            properties: {
                                                uploadUrl: {
                                                    type: string;
                                                    example: string;
                                                };
                                                publicUrl: {
                                                    type: string;
                                                    example: string;
                                                };
                                                key: {
                                                    type: string;
                                                    example: string;
                                                };
                                                expiresIn: {
                                                    type: string;
                                                    example: number;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
    };
};
export declare const setupSwagger: (app: Express) => void;
