import { Request, Response, NextFunction } from 'express';
import { AppError } from '../common/errors/app-error.js';
import { ApiResponse } from '../common/response/api-response.js';
import { env } from '../config/env.js';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    ApiResponse.error(res, err.message, err.code, err.statusCode, err.details);
    return;
  }

  // Log unhandled server errors
  console.error('Unhandled Error:', err);

  const message = env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  ApiResponse.error(res, message, 'INTERNAL_SERVER_ERROR', 500, env.NODE_ENV === 'development' ? err.stack : undefined);
};
