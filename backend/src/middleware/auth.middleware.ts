import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { verifyAccessToken } from '../utils/jwt';

function extractToken(req: Request): string | null {
  const header = req.header('authorization');
  if (header?.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }
  return null;
}

/** Populates req.authUser if a valid access token is present; never throws. */
export const authenticateOptional = (req: Request, _res: Response, next: NextFunction): void => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    req.authUser = verifyAccessToken(token);
  } catch {
    // Invalid/expired token on an optional route just means "anonymous"
  }
  next();
};

/** Requires a valid access token; rejects the request otherwise. */
export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const token = extractToken(req);
  if (!token) {
    return next(ApiError.unauthorized('Authentication token missing'));
  }
  try {
    req.authUser = verifyAccessToken(token);
  } catch {
    return next(ApiError.unauthorized('Invalid or expired token'));
  }
  next();
};
