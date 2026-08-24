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

export class ApiResponse {
  static success<T>(res: Response, message: string, data?: T, statusCode = 200): Response {
    const payload: ApiResponseData<T> = {
      success: true,
      message,
      data,
    };
    return res.status(statusCode).json(payload);
  }

  static created<T>(res: Response, message: string, data?: T): Response {
    return this.success(res, message, data, 201);
  }

  static error(
    res: Response,
    message: string,
    code = 'INTERNAL_SERVER_ERROR',
    statusCode = 500,
    details?: unknown
  ): Response {
    const payload: ApiResponseData = {
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
