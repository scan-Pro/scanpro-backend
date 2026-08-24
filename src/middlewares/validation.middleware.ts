import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../common/errors/app-error.js';

export const validate = (schema: ZodSchema) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      // Optionally assign sanitized data back
      req.body = (parsed as { body?: unknown }).body ?? req.body;
      req.query = (parsed as { query?: unknown }).query as Request['query'] ?? req.query;
      req.params = (parsed as { params?: unknown }).params as Request['params'] ?? req.params;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.').replace(/^(body|query|params)\./, ''),
          message: err.message,
        }));
        next(new ValidationError('Input validation failed', formattedErrors));
      } else {
        next(error);
      }
    }
  };
};
