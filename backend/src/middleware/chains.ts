import { authenticate, authenticateOptional } from './auth.middleware';
import { resolveTenant } from './tenant.middleware';
import { requireRole, requireSameTenant } from './rbac.middleware';
import { requireActiveSubscription } from './subscription.middleware';
import { ROLES } from '../types/roles';

/** Public storefront routes: no login, tenant resolved from header/subdomain. */
export const publicTenantChain = [resolveTenant];

/**
 * Same public storefront surface, but a customer who happens to be logged in
 * gets recognized (their JWT is parsed if present) — used by booking
 * creation so a logged-in customer's bookings link to their account
 * automatically, without *requiring* login (guest checkout still works).
 */
export const publicOrCustomerChain = [authenticateOptional, resolveTenant];

/** Customer-only routes (their own profile/booking history) — logged in via phone+OTP, see customerAuth.routes.ts. */
export const customerChain = [authenticate, resolveTenant, requireSameTenant, requireRole(ROLES.CUSTOMER)];

/** Admin/staff routes: must be logged in, tenant resolved from their own JWT, and role-gated. */
export const adminChain = [authenticate, resolveTenant, requireSameTenant, requireRole(ROLES.SALON_ADMIN, ROLES.SUPERADMIN)];

/** Same as adminChain but also allows staff accounts (read-mostly access). */
export const staffOrAdminChain = [authenticate, resolveTenant, requireSameTenant, requireRole(ROLES.SALON_ADMIN, ROLES.STAFF, ROLES.SUPERADMIN)];

/**
 * Same as adminChain, plus a subscription gate — for creating/editing the
 * salon's content (services/staff/gallery). Deliberately NOT applied to
 * booking management or salon settings; see subscription.middleware.ts.
 */
export const contentAdminChain = [...adminChain, requireActiveSubscription];

/**
 * Platform-ops routes: operate ACROSS tenants (list/manage every salon), so
 * deliberately skip resolveTenant/requireSameTenant entirely — there is no
 * single tenant to resolve to for these requests.
 */
export const superadminChain = [authenticate, requireRole(ROLES.SUPERADMIN)];
