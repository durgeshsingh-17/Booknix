import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';

/**
 * Must run after resolveTenant. Gates the salon's *content management*
 * (services/staff/gallery mutations) behind an active subscription —
 * deliberately scoped narrower than "all admin routes" so a lapsed
 * subscription doesn't also cut off booking management or basic settings,
 * which are far more disruptive to block (see SAAS_SCALING.md).
 *
 * New salons default to subscriptionStatus: 'active' (Salon.ts), so this
 * never blocks anyone until a subscription webhook explicitly cancels it —
 * existing salons/tests are unaffected.
 */
export const requireActiveSubscription = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.tenant) return next(ApiError.unauthorized());
  if (req.tenant.subscriptionStatus === 'cancelled') {
    return next(
      ApiError.paymentRequired('Your subscription has been cancelled. Please renew your plan to add or edit services, staff, and gallery photos.'),
    );
  }
  next();
};
