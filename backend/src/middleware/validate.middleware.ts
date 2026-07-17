import { Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';
import { ApiError } from '../utils/ApiError';

interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/** Validates req.body/query/params against zod schemas and replaces them with the parsed (typed, defaulted) values. */
export const validate = (schemas: ValidationSchemas) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        return next(ApiError.badRequest('Validation failed', result.error.flatten()));
      }
      req.body = result.data;
    }
    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        return next(ApiError.badRequest('Validation failed', result.error.flatten()));
      }
      // Express 5 defines req.query as a getter-only accessor, so it can't be
      // reassigned directly — redefine the property instead.
      Object.defineProperty(req, 'query', { value: result.data, writable: true, configurable: true, enumerable: true });
    }
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        return next(ApiError.badRequest('Validation failed', result.error.flatten()));
      }
      Object.defineProperty(req, 'params', { value: result.data, writable: true, configurable: true, enumerable: true });
    }
    next();
  };
};
