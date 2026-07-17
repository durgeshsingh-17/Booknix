import { z } from 'zod';

const workingHourSchema = z.object({
  day: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
  open: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  close: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  isClosed: z.boolean().default(false),
});

export const createStaffSchema = z.object({
  name: z.string().min(2).max(120),
  avatar: z.string().optional().default(''),
  specialties: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).optional().default([]),
  workingHours: z.array(workingHourSchema).nullable().optional().default(null),
  isActive: z.coerce.boolean().optional().default(true),
});

export const updateStaffSchema = createStaffSchema.partial();

export const updateStaffSubscriptionSchema = z.object({
  plan: z.enum(['trial', 'basic', 'pro']).optional(),
  subscriptionStatus: z.enum(['active', 'past_due', 'cancelled']).optional(),
  // ISO date string or null to clear the expiry (no enforced end date).
  subscriptionExpiresAt: z.string().datetime().nullable().optional(),
});
