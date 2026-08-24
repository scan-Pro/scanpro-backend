import { Response } from 'express';
export interface ApiResponseData<T = unknown> {
    success: boolean;
    message: string;
    data?: T;
    error?: {
        code: string;
        details?: unknown;
    };
}
export declare class ApiResponse {
    static success<T>(res: Response, message: string, data?: T, statusCode?: number): Response;
    static created<T>(res: Response, message: string, data?: T): Response;
    static error(res: Response, message: string, code?: string, statusCode?: number, details?: unknown): Response;
}
