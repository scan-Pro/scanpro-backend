import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../common/errors/app-error.js';
export const authenticate = (req, _res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(new UnauthorizedError('Access token is missing or invalid', 'TOKEN_MISSING'));
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
        req.user = decoded;
        next();
    }
    catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return next(new UnauthorizedError('Access token has expired', 'TOKEN_EXPIRED'));
        }
        return next(new UnauthorizedError('Invalid access token', 'TOKEN_INVALID'));
    }
};
//# sourceMappingURL=auth.middleware.js.map