export declare class AppError extends Error {
    readonly statusCode: number;
    readonly code: string;
    readonly isOperational: boolean;
    readonly details?: unknown;
    constructor(message: string, statusCode?: number, code?: string, details?: unknown);
}
export declare class NotFoundError extends AppError {
    constructor(message?: string, code?: string, details?: unknown);
}
export declare class UnauthorizedError extends AppError {
    constructor(message?: string, code?: string, details?: unknown);
}
export declare class ForbiddenError extends AppError {
    constructor(message?: string, code?: string, details?: unknown);
}
export declare class BadRequestError extends AppError {
    constructor(message?: string, code?: string, details?: unknown);
}
export declare class ConflictError extends AppError {
    constructor(message?: string, code?: string, details?: unknown);
}
export declare class ValidationError extends AppError {
    constructor(message?: string, details?: unknown);
}
