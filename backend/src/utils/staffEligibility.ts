import { IStaff } from '../models/Staff';

/**
 * The "barber subscription" gate: a staff member can only receive new
 * bookings while their own per-seat subscription is active and unexpired.
 * This is independent of (and in addition to) the salon's own subscription
 * (see subscription.middleware.ts) — a salon can be in good standing overall
 * while one specific barber's individual seat has lapsed.
 */
export function isStaffBookable(staff: Pick<IStaff, 'isActive' | 'subscriptionStatus' | 'subscriptionExpiresAt'>): boolean {
  if (!staff.isActive) return false;
  if (staff.subscriptionStatus === 'cancelled') return false;
  if (staff.subscriptionExpiresAt && staff.subscriptionExpiresAt.getTime() < Date.now()) return false;
  return true;
}

/** The Mongo-query equivalent of isStaffBookable(), for filtering staff lists directly in the database rather than in application code. */
export function bookableStaffQueryFilter(): Record<string, unknown> {
  return {
    isActive: true,
    subscriptionStatus: { $ne: 'cancelled' },
    $or: [{ subscriptionExpiresAt: null }, { subscriptionExpiresAt: { $gt: new Date() } }],
  };
}
