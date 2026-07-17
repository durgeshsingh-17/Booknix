import Salon from '../models/Salon';
import User from '../models/User';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';
import { resolveSubdomain } from '../utils/subdomain';

interface ListSalonsParams {
  search?: string | undefined;
  page: number;
  limit: number;
}

export async function listSalons(params: ListSalonsParams) {
  const filter: Record<string, unknown> = {};
  if (params.search) {
    const regex = new RegExp(params.search.trim(), 'i');
    filter.$or = [{ name: regex }, { slug: regex }, { subdomain: regex }, { email: regex }];
  }

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    Salon.find(filter).sort({ createdAt: -1 }).skip(skip).limit(params.limit),
    Salon.countDocuments(filter),
  ]);

  return { items, total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) || 1 };
}

export async function getSalonDetail(salonId: string) {
  const salon = await Salon.findById(salonId);
  if (!salon) throw ApiError.notFound('Salon not found');
  const owner = salon.ownerUserId ? await User.findById(salon.ownerUserId).select('name email phone') : null;
  return { salon, owner };
}

export async function setSalonActive(salonId: string, isActive: boolean) {
  const salon = await Salon.findByIdAndUpdate(salonId, { isActive }, { new: true });
  if (!salon) throw ApiError.notFound('Salon not found');
  return salon;
}

export async function setSubscriptionStatus(salonId: string, subscriptionStatus: 'active' | 'past_due' | 'cancelled') {
  const salon = await Salon.findByIdAndUpdate(salonId, { subscriptionStatus }, { new: true });
  if (!salon) throw ApiError.notFound('Salon not found');
  return salon;
}

/**
 * Called by Caddy's On-Demand TLS "ask" hook before it will fetch a
 * certificate for a hostname it hasn't seen before — without this check,
 * anyone who points DNS at your server could get you to issue (rate-limited,
 * but still unwanted) certificates for arbitrary hostnames. Returns true only
 * for the apex/www domain or a subdomain belonging to an active salon.
 */
export async function isDomainAllowedForTls(hostname: string): Promise<boolean> {
  const apex = env.ROOT_DOMAIN.replace(/^\./, '');
  if (hostname === apex || hostname === `www.${apex}`) return true;

  const subdomain = resolveSubdomain(hostname);
  if (!subdomain) return false;

  const exists = await Salon.exists({ subdomain, isActive: true });
  return Boolean(exists);
}
