export class ApiResponse {
    static success(res, message, data, statusCode = 200) {
        const payload = {
            success: true,
            message,
            data,
        };
        return res.status(statusCode).json(payload);
    }
    static created(res, message, data) {
        return this.success(res, message, data, 201);
    }
    static error(res, message, code = 'INTERNAL_SERVER_ERROR', statusCode = 500, details) {
        const payload = {
            success: false,
            message,
            error: {
                code,
                ...(details ? { details } : {}),
            },
        };
        return res.status(statusCode).json(payload);
    }
}
//# sourceMappingURL=api-response.js.map