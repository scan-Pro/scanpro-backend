import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

export type JwtTokenType = 'access' | 'refresh';

export interface ScaniroJwtPayload extends jwt.JwtPayload {
  userId: string;
  email: string;
  tokenType: JwtTokenType;
  iat: number;
  exp: number;
  jti: string;
}

const algorithm: jwt.Algorithm = 'HS256';

export function signScaniroToken(
  userId: string,
  email: string,
  tokenType: JwtTokenType,
  secret: string,
  expiresIn: jwt.SignOptions['expiresIn'],
): string {
  return jwt.sign(
    { userId, email, tokenType },
    secret,
    {
      algorithm,
      audience: env.JWT_AUDIENCE,
      expiresIn,
      issuer: env.JWT_ISSUER,
      jwtid: randomUUID(),
    },
  );
}

export function verifyScaniroToken(
  token: string,
  tokenType: JwtTokenType,
  secret: string,
): ScaniroJwtPayload {
  const decoded = jwt.verify(token, secret, {
    algorithms: [algorithm],
    audience: env.JWT_AUDIENCE,
    issuer: env.JWT_ISSUER,
  });

  if (
    typeof decoded === 'string' ||
    typeof decoded.userId !== 'string' ||
    typeof decoded.email !== 'string' ||
    decoded.tokenType !== tokenType ||
    typeof decoded.iat !== 'number' ||
    typeof decoded.exp !== 'number' ||
    typeof decoded.jti !== 'string' ||
    decoded.jti.length === 0
  ) {
    throw new jwt.JsonWebTokenError('Invalid token claims');
  }

  return decoded as ScaniroJwtPayload;
}

export function verifyLegacyRefreshToken(
  token: string,
  secret: string,
): jwt.JwtPayload & { userId: string; email: string; exp: number } {
  const decoded = jwt.verify(token, secret, { algorithms: [algorithm] });
  if (
    typeof decoded === 'string' ||
    typeof decoded.userId !== 'string' ||
    typeof decoded.email !== 'string' ||
    typeof decoded.exp !== 'number'
  ) {
    throw new jwt.JsonWebTokenError('Invalid legacy token claims');
  }
  return decoded as jwt.JwtPayload & {
    userId: string;
    email: string;
    exp: number;
  };
}

export function verifyLegacyAccessToken(
  token: string,
  secret: string,
): jwt.JwtPayload & { userId: string; email: string; exp: number } {
  const decoded = jwt.verify(token, secret, { algorithms: [algorithm] });
  if (
    typeof decoded === 'string' ||
    typeof decoded.userId !== 'string' ||
    typeof decoded.email !== 'string' ||
    typeof decoded.iat !== 'number' ||
    typeof decoded.exp !== 'number' ||
    decoded.tokenType !== undefined
  ) {
    throw new jwt.JsonWebTokenError('Invalid legacy access-token claims');
  }
  return decoded as jwt.JwtPayload & {
    userId: string;
    email: string;
    exp: number;
  };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
