import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ApiError } from '../utils/ApiError';
import { logger } from '../config/logger';
import { env } from '../config/env';

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  let statusCode = 500;
  let message = 'Internal server error';
  let errors: unknown;

  // The *real* message always gets logged server-side, regardless of what
  // (if anything) is safe to show the client below.
  const logMessage = err instanceof Error ? err.message : 'Unknown error';

  if (err instanceof ApiError) {
    // Deliberately-thrown, client-safe errors (400/401/403/404/409/etc.) —
    // always fine to show verbatim, that's the whole point of ApiError.
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
  } else if (err instanceof multer.MulterError || (err instanceof Error && /image/i.test(err.message))) {
    statusCode = 400;
    message = (err as Error).message;
  } else if (err instanceof Error && !env.isProduction) {
    // An unexpected (non-ApiError) exception — in production this stays the
    // generic "Internal server error" default above so implementation
    // details (library errors, file paths, config state) never leak to
    // the client; only relaxed for local/dev debugging convenience.
    message = err.message;
  }

  if (statusCode >= 500) {
    logger.error(logMessage, { path: req.originalUrl, method: req.method, error: err });
  } else {
    logger.warn(logMessage, { path: req.originalUrl, method: req.method });
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors ? { errors } : {}),
    ...(env.isProduction ? {} : { stack: err instanceof Error ? err.stack : undefined }),
  });
};
