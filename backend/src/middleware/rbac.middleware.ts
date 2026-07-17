import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { Role } from '../types/roles';

/** Must run after `authenticate`. Restricts a route to the given roles. */
export const requireRole = (...allowedRoles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      return next(ApiError.unauthorized());
    }
    if (!allowedRoles.includes(req.authUser.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };
};

/**
 * Must run after `authenticate` and `resolveTenant`. Ensures a salonAdmin/staff
 * user's JWT salonId claim matches the resolved tenant — prevents an admin
 * token from one salon being replayed against another salon's data.
 */
export const requireSameTenant = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.authUser || !req.tenant) {
    return next(ApiError.unauthorized());
  }
  if (req.authUser.role === 'superadmin') return next();
  if (req.authUser.salonId !== String(req.tenant._id)) {
    return next(ApiError.forbidden('This account does not have access to this salon'));
  }
  next();
};
