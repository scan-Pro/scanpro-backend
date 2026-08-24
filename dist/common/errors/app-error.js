export class AppError extends Error {
    statusCode;
    code;
    isOperational;
    details;
    constructor(message, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}
export class NotFoundError extends AppError {
    constructor(message = 'Resource not found', code = 'NOT_FOUND', details) {
        super(message, 404, code, details);
    }
}
export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized access', code = 'UNAUTHORIZED', details) {
        super(message, 401, code, details);
    }
}
export class ForbiddenError extends AppError {
    constructor(message = 'Forbidden action', code = 'FORBIDDEN', details) {
        super(message, 403, code, details);
    }
}
export class BadRequestError extends AppError {
    constructor(message = 'Bad request', code = 'BAD_REQUEST', details) {
        super(message, 400, code, details);
    }
}
export class ConflictError extends AppError {
    constructor(message = 'Conflict with existing resource', code = 'CONFLICT', details) {
        super(message, 409, code, details);
    }
}
export class ValidationError extends AppError {
    constructor(message = 'Validation failed', details) {
        super(message, 422, 'VALIDATION_ERROR', details);
    }
}
//# sourceMappingURL=app-error.js.map