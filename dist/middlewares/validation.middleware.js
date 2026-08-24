import { ZodError } from 'zod';
import { ValidationError } from '../common/errors/app-error.js';
export const validate = (schema) => {
    return async (req, _res, next) => {
        try {
            const parsed = await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            // Optionally assign sanitized data back
            req.body = parsed.body ?? req.body;
            req.query = parsed.query ?? req.query;
            req.params = parsed.params ?? req.params;
            next();
        }
        catch (error) {
            if (error instanceof ZodError) {
                const formattedErrors = error.errors.map((err) => ({
                    field: err.path.join('.').replace(/^(body|query|params)\./, ''),
                    message: err.message,
                }));
                next(new ValidationError('Input validation failed', formattedErrors));
            }
            else {
                next(error);
            }
        }
    };
};
//# sourceMappingURL=validation.middleware.js.map