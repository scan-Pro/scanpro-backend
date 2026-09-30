import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../common/errors/app-error.js';
import { AuthenticatedRequest, JwtPayload } from '../common/types/index.js';
import { env } from '../config/env.js';
import {
  verifyLegacyAccessToken,
  verifyScaniroToken,
} from '../common/utils/jwt.util.js';

export const authenticate = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Access token is missing or invalid', 'TOKEN_MISSING'));
  }

  const token = authHeader.split(' ')[1];

  try {
    let decoded: { userId: string; email: string };
    try {
      decoded = verifyScaniroToken(
        token,
        'access',
        env.JWT_ACCESS_SECRET,
      );
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) throw error;
      decoded = verifyLegacyAccessToken(token, env.JWT_ACCESS_SECRET);
    }
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    } satisfies JwtPayload;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new UnauthorizedError('Access token has expired', 'TOKEN_EXPIRED'));
    }
    return next(new UnauthorizedError('Invalid access token', 'TOKEN_INVALID'));
  }
};
