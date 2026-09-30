import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../common/errors/app-error.js';
import { ApiResponse } from '../common/response/api-response.js';
import { env } from '../config/env.js';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) console.error('Application Error:', err);
    const isProductionServerError =
      env.NODE_ENV === 'production' && err.statusCode >= 500;
    ApiResponse.error(
      res,
      isProductionServerError ? 'Internal server error' : err.message,
      isProductionServerError ? 'INTERNAL_SERVER_ERROR' : err.code,
      err.statusCode,
      isProductionServerError ? undefined : err.details
    );
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      ApiResponse.error(res, 'A record with these details already exists', 'CONFLICT', 409);
      return;
    }
    if (err.code === 'P2025') {
      ApiResponse.error(res, 'The requested record was not found', 'NOT_FOUND', 404);
      return;
    }
    if (err.code === 'P2003' || err.code === 'P2014') {
      ApiResponse.error(res, 'The request references invalid related data', 'INVALID_REFERENCE', 400);
      return;
    }
    if (err.code === 'P2024') {
      console.error('Database connection pool timed out:', err);
      ApiResponse.error(res, 'Service temporarily unavailable', 'DATABASE_UNAVAILABLE', 503);
      return;
    }
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    ApiResponse.error(res, 'The request contains invalid data', 'VALIDATION_ERROR', 400);
    return;
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    console.error('Database initialization failed:', err);
    ApiResponse.error(res, 'Service temporarily unavailable', 'DATABASE_UNAVAILABLE', 503);
    return;
  }

  const candidate = err as Error & { status?: number; type?: string };
  if (candidate.type === 'entity.parse.failed') {
    ApiResponse.error(res, 'Malformed JSON request body', 'INVALID_JSON', 400);
    return;
  }
  if (candidate.type === 'entity.too.large') {
    ApiResponse.error(res, 'Request body is too large', 'PAYLOAD_TOO_LARGE', 413);
    return;
  }
  if (candidate.type === 'charset.unsupported' || candidate.type === 'encoding.unsupported') {
    ApiResponse.error(res, 'Unsupported request encoding', 'UNSUPPORTED_ENCODING', 415);
    return;
  }

  console.error('Unhandled Error:', err);
  const message = env.NODE_ENV === 'production'
    ? 'Internal server error'
    : candidate.message;
  ApiResponse.error(
    res,
    message,
    'INTERNAL_SERVER_ERROR',
    500,
    env.NODE_ENV === 'development' ? candidate.stack : undefined
  );
};
