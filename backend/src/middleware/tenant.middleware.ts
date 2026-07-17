import { Request, Response, NextFunction } from 'express';
import Salon from '../models/Salon';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { resolveSubdomain } from '../utils/subdomain';

/**
 * Resolves the tenant (Salon) for the request from, in priority order:
 * 1. An already-authenticated JWT's salonId claim (staff/admin requests)
 * 2. X-Salon-Slug header (used by local dev / the SPA before login)
 * 3. Request subdomain (production: shreesalon.yoursaas.in)
 * Attaches the resolved Salon document to req.tenant. Every tenant-scoped
 * controller/service must filter by req.tenant._id — this middleware only
 * identifies the tenant, it does not authorize the request.
 */
export const resolveTenant = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  let salon = null;

  if (req.authUser?.salonId) {
    salon = await Salon.findById(req.authUser.salonId);
  }

  if (!salon) {
    const headerSlug = req.header('x-salon-slug');
    if (headerSlug) {
      salon = await Salon.findOne({ slug: headerSlug.toLowerCase().trim() });
    }
  }

  if (!salon) {
    const subdomain = resolveSubdomain(req.header('host'));
    if (subdomain) {
      salon = await Salon.findOne({ subdomain });
    }
  }

  if (!salon || !salon.isActive) {
    throw ApiError.notFound('Salon not found');
  }

  req.tenant = salon;
  next();
});
