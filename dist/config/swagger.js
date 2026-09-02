import swaggerUi from 'swagger-ui-express';
import { env } from './env.js';
export const swaggerSpec = {
    openapi: '3.0.3',
    info: {
        title: 'ScanPro API Documentation',
        version: '1.0.0',
        description: `
## 📄 ScanPro Backend Services

Production-ready REST API for the **ScanPro Document Scanner** ecosystem.

### Key Capabilities:
- **Authentication**: JWT access & refresh token rotation, bcrypt password hashing.
- **Documents**: Multi-page document storage, pagination, filtering, search, and page ordering.
- **Folders**: Organizational hierarchy for categorized document management.
- **Cloud Sync & Uploads**: AWS S3 / MinIO pre-signed URL generation for direct asset uploads.
- **User Management**: Profile updates, password changes, and account deletion.

---
### 🔐 Authentication Flow
1. Register via \`POST /api/v1/auth/register\` or Login via \`POST /api/v1/auth/login\`.
2. Copy the returned \`accessToken\`.
3. Click the **Authorize** button (top right) and paste the token in the format: \`<your-token>\`.
    `,
        contact: {
            name: 'ScanPro Engineering Team',
            email: 'support@scanpro.app',
        },
        license: {
            name: 'ISC License',
        },
    },
    servers: [
        {
            url: '/api/v1',
            description: 'Current Host (Recommended for Swagger UI & Ngrok)',
        },
        {
            url: `http://localhost:${env.PORT}/api/v1`,
            description: 'Localhost Server (Default / iOS Simulator)',
        },
        {
            url: `http://10.0.2.2:${env.PORT}/api/v1`,
            description: 'Android Emulator Loopback',
        },
        {
            url: 'https://encircle-kudos-vineyard.ngrok-free.dev/api/v1',
            description: 'Ngrok Public Tunnel Server',
        },
    ],
    tags: [
        { name: 'Health', description: 'System health, status, and uptime checks' },
        { name: 'Auth', description: 'User registration, login, token refresh, and logout' },
        { name: 'Users', description: 'User profile management and security' },
        { name: 'Folders', description: 'Create, read, update, and delete document folders' },
        { name: 'Documents', description: 'Manage scanned multi-page documents and metadata' },
        { name: 'Uploads', description: 'S3 / MinIO presigned URL generator for secure cloud sync' },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'Enter your JWT access token to authenticate requests.',
            },
        },
        schemas: {
            // Common Responses
            SuccessResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Operation completed successfully' },
                    data: { type: 'object' },
                },
            },
            ErrorResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'Validation failed or resource not found' },
                    error: {
                        type: 'object',
                        properties: {
                            code: { type: 'string', example: 'VALIDATION_ERROR' },
                            details: { type: 'object' },
                        },
                    },
                },
            },
            // Models
            User: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid', example: 'd3b07384-d113-4c56-8344-77dd7143e49e' },
                    email: { type: 'string', format: 'email', example: 'alex@example.com' },
                    name: { type: 'string', example: 'Alex Morgan' },
                    avatarUrl: { type: 'string', nullable: true, example: 'https://s3.amazonaws.com/scanpro/avatars/user.jpg' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            AuthTokens: {
                type: 'object',
                properties: {
                    accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                    refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                    expiresIn: { type: 'string', example: '15m' },
                },
            },
            AuthResponseData: {
                type: 'object',
                properties: {
                    user: { $ref: '#/components/schemas/User' },
                    tokens: { $ref: '#/components/schemas/AuthTokens' },
                },
            },
            Folder: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid', example: 'e4a2d815-58a2-4a7b-b054-94c6efd2568a' },
                    name: { type: 'string', example: 'Tax Invoices 2026' },
                    userId: { type: 'string', format: 'uuid' },
                    documentCount: { type: 'integer', example: 4 },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            DocumentPage: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d' },
                    documentId: { type: 'string', format: 'uuid' },
                    pageOrder: { type: 'integer', example: 0 },
                    imageUrl: { type: 'string', example: 'https://s3.amazonaws.com/scanpro/pages/p1.jpg' },
                    thumbnailUrl: { type: 'string', nullable: true, example: 'https://s3.amazonaws.com/scanpro/thumbs/p1.jpg' },
                    filter: { type: 'string', enum: ['ORIGINAL', 'AUTO', 'MAGIC_COLOR', 'GRAYSCALE', 'BLACK_AND_WHITE'], example: 'MAGIC_COLOR' },
                    rotation: { type: 'integer', example: 0 },
                    createdAt: { type: 'string', format: 'date-time' },
                },
            },
            Document: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid', example: 'f8c3d2e1-4b5a-6789-0123-456789abcdef' },
                    userId: { type: 'string', format: 'uuid' },
                    folderId: { type: 'string', format: 'uuid', nullable: true, example: 'e4a2d815-58a2-4a7b-b054-94c6efd2568a' },
                    title: { type: 'string', example: 'Scan_20260825_001' },
                    thumbnailUrl: { type: 'string', nullable: true, example: 'https://s3.amazonaws.com/scanpro/thumbs/doc_thumb.jpg' },
                    pdfUrl: { type: 'string', nullable: true, example: 'https://s3.amazonaws.com/scanpro/pdfs/Scan_20260825_001.pdf' },
                    pageCount: { type: 'integer', example: 2 },
                    isFavorite: { type: 'boolean', example: false },
                    syncStatus: { type: 'string', enum: ['PENDING', 'SYNCED', 'FAILED'], example: 'SYNCED' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    pages: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/DocumentPage' },
                    },
                    folder: {
                        $ref: '#/components/schemas/Folder',
                    },
                },
            },
            // DTOs
            RegisterDto: {
                type: 'object',
                required: ['email', 'password', 'name'],
                properties: {
                    name: { type: 'string', minLength: 2, maxLength: 50, example: 'Alex Morgan' },
                    email: { type: 'string', format: 'email', example: 'alex@example.com' },
                    password: { type: 'string', minLength: 8, maxLength: 64, example: 'SuperSecret123!' },
                },
            },
            LoginDto: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                    email: { type: 'string', format: 'email', example: 'alex@example.com' },
                    password: { type: 'string', example: 'SuperSecret123!' },
                },
            },
            RefreshTokenDto: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                    refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                },
            },
            CreateFolderDto: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: { type: 'string', minLength: 1, maxLength: 50, example: 'Tax Receipts 2026' },
                },
            },
            UpdateFolderDto: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: { type: 'string', minLength: 1, maxLength: 50, example: 'Medical Records' },
                },
            },
            CreateDocumentPageDto: {
                type: 'object',
                required: ['pageOrder', 'imageUrl'],
                properties: {
                    id: { type: 'string', format: 'uuid', description: 'Optional local page ID' },
                    pageOrder: { type: 'integer', example: 0 },
                    imageUrl: { type: 'string', example: 'https://s3.amazonaws.com/scanpro/pages/page_0.jpg' },
                    thumbnailUrl: { type: 'string', nullable: true, example: 'https://s3.amazonaws.com/scanpro/thumbs/page_0.jpg' },
                    filter: { type: 'string', enum: ['ORIGINAL', 'AUTO', 'MAGIC_COLOR', 'GRAYSCALE', 'BLACK_AND_WHITE'], default: 'ORIGINAL' },
                    rotation: { type: 'integer', default: 0, example: 0 },
                },
            },
            CreateDocumentDto: {
                type: 'object',
                required: ['title'],
                properties: {
                    id: { type: 'string', format: 'uuid', description: 'Optional local client ID for idempotent synchronization', example: 'f8c3d2e1-4b5a-6789-0123-456789abcdef' },
                    title: { type: 'string', minLength: 1, maxLength: 100, example: 'Office Lease Agreement' },
                    folderId: { type: 'string', format: 'uuid', nullable: true, example: 'e4a2d815-58a2-4a7b-b054-94c6efd2568a' },
                    thumbnailUrl: { type: 'string', nullable: true, example: 'https://s3.amazonaws.com/scanpro/thumbs/thumb.jpg' },
                    pdfUrl: { type: 'string', nullable: true, example: 'https://s3.amazonaws.com/scanpro/pdfs/contract.pdf' },
                    pageCount: { type: 'integer', example: 2 },
                    isFavorite: { type: 'boolean', default: false },
                    pages: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/CreateDocumentPageDto' },
                    },
                },
            },
            UpdateDocumentDto: {
                type: 'object',
                properties: {
                    title: { type: 'string', minLength: 1, maxLength: 100, example: 'Signed Lease Agreement' },
                    folderId: { type: 'string', format: 'uuid', nullable: true },
                    thumbnailUrl: { type: 'string', nullable: true },
                    pdfUrl: { type: 'string', nullable: true },
                    isFavorite: { type: 'boolean' },
                },
            },
            ToggleFavoriteDto: {
                type: 'object',
                required: ['isFavorite'],
                properties: {
                    isFavorite: { type: 'boolean', example: true },
                },
            },
            MoveFolderDto: {
                type: 'object',
                properties: {
                    folderId: { type: 'string', format: 'uuid', nullable: true, example: 'e4a2d815-58a2-4a7b-b054-94c6efd2568a' },
                },
            },
            GetPresignedUrlDto: {
                type: 'object',
                required: ['fileName', 'fileType', 'folder'],
                properties: {
                    fileName: { type: 'string', example: 'scan_page_1.jpg' },
                    fileType: { type: 'string', example: 'image/jpeg' },
                    folder: { type: 'string', enum: ['pages', 'thumbnails', 'pdfs', 'avatars'], example: 'pages' },
                },
            },
        },
    },
    paths: {
        // 1. Health
        '/health': {
            get: {
                tags: ['Health'],
                summary: 'Check API health and status',
                responses: {
                    200: {
                        description: 'API is running healthy',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'ScanPro API is running healthy' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                status: { type: 'string', example: 'UP' },
                                                timestamp: { type: 'string', format: 'date-time' },
                                                version: { type: 'string', example: '1.0.0' },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        // 2. Auth
        '/auth/register': {
            post: {
                tags: ['Auth'],
                summary: 'Register a new user account',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/RegisterDto' },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'User registered successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'User registered successfully' },
                                        data: { $ref: '#/components/schemas/AuthResponseData' },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                    409: { description: 'Email already exists', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                },
            },
        },
        '/auth/login': {
            post: {
                tags: ['Auth'],
                summary: 'Log in with email & password',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/LoginDto' },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Login successful',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'Login successful' },
                                        data: { $ref: '#/components/schemas/AuthResponseData' },
                                    },
                                },
                            },
                        },
                    },
                    401: { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                },
            },
        },
        '/auth/refresh': {
            post: {
                tags: ['Auth'],
                summary: 'Refresh expired JWT access token',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/RefreshTokenDto' },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Token refreshed successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'Token refreshed successfully' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                tokens: { $ref: '#/components/schemas/AuthTokens' },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    401: { description: 'Invalid or expired refresh token', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                },
            },
        },
        '/auth/logout': {
            post: {
                tags: ['Auth'],
                summary: 'Logout user session',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Logged out successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'Logged out successfully' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        // 3. Users
        '/users/profile': {
            get: {
                tags: ['Users'],
                summary: 'Get current authenticated user profile',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: 'User profile retrieved',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        data: { $ref: '#/components/schemas/User' },
                                    },
                                },
                            },
                        },
                    },
                    401: { description: 'Unauthorized' },
                },
            },
            patch: {
                tags: ['Users'],
                summary: 'Update current user profile',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string', example: 'Alex M.' },
                                    avatarUrl: { type: 'string', example: 'https://s3.amazonaws.com/scanpro/avatars/new.jpg' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Profile updated successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        data: { $ref: '#/components/schemas/User' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/users/change-password': {
            post: {
                tags: ['Users'],
                summary: 'Change account password',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['currentPassword', 'newPassword'],
                                properties: {
                                    currentPassword: { type: 'string', example: 'SuperSecret123!' },
                                    newPassword: { type: 'string', minLength: 8, example: 'NewSecretPass2026!' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Password changed successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'Password changed successfully' },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'Incorrect current password or validation error' },
                },
            },
        },
        '/users/account': {
            delete: {
                tags: ['Users'],
                summary: 'Permanently delete user account and all associated documents & data',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Account deleted successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'Account deleted successfully' },
                                    },
                                },
                            },
                        },
                    },
                    401: { description: 'Unauthorized or token expired' },
                },
            },
        },
        // 4. Folders
        '/folders': {
            get: {
                tags: ['Folders'],
                summary: 'Get all folders for authenticated user',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: 'List of folders',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        data: {
                                            type: 'array',
                                            items: { $ref: '#/components/schemas/Folder' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            post: {
                tags: ['Folders'],
                summary: 'Create a new folder',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/CreateFolderDto' },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'Folder created successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'Folder created successfully' },
                                        data: { $ref: '#/components/schemas/Folder' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/folders/{id}': {
            get: {
                tags: ['Folders'],
                summary: 'Get single folder by ID',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                ],
                responses: {
                    200: {
                        description: 'Folder details',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        data: { $ref: '#/components/schemas/Folder' },
                                    },
                                },
                            },
                        },
                    },
                    404: { description: 'Folder not found' },
                },
            },
            patch: {
                tags: ['Folders'],
                summary: 'Rename / update folder',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/UpdateFolderDto' },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Folder updated successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        data: { $ref: '#/components/schemas/Folder' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            delete: {
                tags: ['Folders'],
                summary: 'Delete folder',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                ],
                responses: {
                    200: {
                        description: 'Folder deleted successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'Folder deleted successfully' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        // 5. Documents
        '/documents': {
            get: {
                tags: ['Documents'],
                summary: 'Get list of documents with pagination & filters',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
                    { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Filter by title substring' },
                    { name: 'folderId', in: 'query', schema: { type: 'string', format: 'uuid' }, description: 'Filter by specific folder' },
                    { name: 'isFavorite', in: 'query', schema: { type: 'boolean' }, description: 'Filter favorites only' },
                ],
                responses: {
                    200: {
                        description: 'Paginated documents list',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                documents: {
                                                    type: 'array',
                                                    items: { $ref: '#/components/schemas/Document' },
                                                },
                                                pagination: {
                                                    type: 'object',
                                                    properties: {
                                                        page: { type: 'integer', example: 1 },
                                                        limit: { type: 'integer', example: 20 },
                                                        total: { type: 'integer', example: 45 },
                                                        totalPages: { type: 'integer', example: 3 },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            post: {
                tags: ['Documents'],
                summary: 'Create / Sync a scanned document with pages',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/CreateDocumentDto' },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'Document created successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'Document created successfully' },
                                        data: { $ref: '#/components/schemas/Document' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/documents/{id}': {
            get: {
                tags: ['Documents'],
                summary: 'Get complete document details with all pages',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                ],
                responses: {
                    200: {
                        description: 'Document details',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        data: { $ref: '#/components/schemas/Document' },
                                    },
                                },
                            },
                        },
                    },
                    404: { description: 'Document not found' },
                },
            },
            patch: {
                tags: ['Documents'],
                summary: 'Update document metadata',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/UpdateDocumentDto' },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Document updated successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        data: { $ref: '#/components/schemas/Document' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            delete: {
                tags: ['Documents'],
                summary: 'Delete document and all associated pages',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                ],
                responses: {
                    200: {
                        description: 'Document deleted successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'Document deleted successfully' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/documents/{id}/favorite': {
            patch: {
                tags: ['Documents'],
                summary: 'Toggle favorite status for document',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ToggleFavoriteDto' },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Favorite status toggled',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        data: { $ref: '#/components/schemas/Document' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/documents/{id}/folder': {
            patch: {
                tags: ['Documents'],
                summary: 'Move document to a folder or unassign to root',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/MoveFolderDto' },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Document folder updated',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        data: { $ref: '#/components/schemas/Document' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        // 6. Uploads
        '/uploads/presigned-url': {
            post: {
                tags: ['Uploads'],
                summary: 'Generate AWS S3 / MinIO presigned URL for direct upload',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/GetPresignedUrlDto' },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Presigned upload URL generated',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'Presigned upload URL generated successfully' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                uploadUrl: { type: 'string', example: 'https://scanpro-bucket.s3.amazonaws.com/pages/...' },
                                                fileUrl: { type: 'string', example: 'https://scanpro-bucket.s3.amazonaws.com/pages/scan_page_1.jpg' },
                                                key: { type: 'string', example: 'pages/d3b07384/1787600000000-scan_page_1.jpg' },
                                                expiresIn: { type: 'integer', example: 3600 },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
};
const customCss = `
  .swagger-ui .topbar { background-color: #0B1F3A; border-bottom: 2px solid #00A6A6; }
  .swagger-ui .topbar .topbar-wrapper .link { content: url(''); }
  .swagger-ui .topbar .topbar-wrapper::before {
    content: 'ScanPro API Docs';
    color: #FFFFFF;
    font-size: 1.3rem;
    font-weight: 700;
    font-family: 'Inter', sans-serif;
    letter-spacing: 0.5px;
  }
  .swagger-ui .btn.authorize { color: #00A6A6; border-color: #00A6A6; }
  .swagger-ui .btn.authorize svg { fill: #00A6A6; }
  .swagger-ui .opblock.opblock-post { border-color: #00A6A6; background: rgba(0, 166, 166, 0.05); }
  .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #00A6A6; }
  .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #0B1F3A; }
  .swagger-ui .opblock.opblock-patch .opblock-summary-method { background: #E67E22; }
  .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #D92D20; }
  .swagger-ui .info h2 { color: #0B1F3A; font-weight: 700; }
  .swagger-ui .info a { color: #00A6A6; }
`;
export const setupSwagger = (app) => {
    const swaggerOptions = {
        customCss,
        customSiteTitle: 'ScanPro API Documentation',
        swaggerOptions: {
            persistAuthorization: true,
            displayRequestDuration: true,
            docExpansion: 'list',
            filter: true,
            tryItOutEnabled: true,
        },
    };
    // Serve Swagger UI at both /docs and /api/v1/docs
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerOptions));
    app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerOptions));
    // Serve Raw OpenAPI JSON Schema at /docs.json and /api/v1/docs.json
    app.get('/docs.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerSpec);
    });
    app.get('/api/v1/docs.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerSpec);
    });
};
//# sourceMappingURL=swagger.js.map