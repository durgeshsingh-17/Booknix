import { NextFunction, Request, Response } from 'express';

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * Express 5 forwards rejected promises to next() automatically, but wrapping
 * keeps intent explicit and protects against sync throws in odd edge cases.
 */
export const asyncHandler = (handler: AsyncRouteHandler) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};
