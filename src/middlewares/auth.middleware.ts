import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ConflictError, UnauthorizedError } from '../common/errors/app-error.js';
import { AuthenticatedRequest, JwtPayload } from '../common/types/index.js';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';
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
      decoded = verifyScaniroToken(token, 'access', env.JWT_ACCESS_SECRET);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) throw error;
      decoded = verifyLegacyAccessToken(token, env.JWT_ACCESS_SECRET);
    }
    req.user = { userId: decoded.userId, email: decoded.email } satisfies JwtPayload;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new UnauthorizedError('Access token has expired', 'TOKEN_EXPIRED'));
    }
    return next(new UnauthorizedError('Invalid access token', 'TOKEN_INVALID'));
  }
};

/**
 * Route-level rejection for mutations after account deletion has been marked.
 * Mutating repositories additionally lock the user row and re-check lifecycle
 * state transactionally, so requests already in flight cannot race the marker.
 */
export const requireActiveAccount = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      next(new UnauthorizedError('Authentication is required', 'TOKEN_MISSING'));
      return;
    }
    const user = await prisma.user.findFirst({
      where: { id: userId, lifecycleStatus: 'ACTIVE' },
      select: { id: true },
    });
    if (!user) {
      next(new ConflictError('Account deletion is in progress; mutations are not allowed', 'ACCOUNT_DELETION_IN_PROGRESS'));
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};
