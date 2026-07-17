import { z } from 'zod';

export const listSalonsQuerySchema = z.object({
  search: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const setSalonActiveSchema = z.object({
  isActive: z.boolean(),
});

export const setSubscriptionStatusSchema = z.object({
  subscriptionStatus: z.enum(['active', 'past_due', 'cancelled']),
});

export const salonIdParamSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id'),
});
