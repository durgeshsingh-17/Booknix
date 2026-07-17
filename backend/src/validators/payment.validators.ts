import { z } from 'zod';

export const createOrderSchema = z.object({
  bookingId: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id'),
  provider: z.enum(['razorpay', 'stripe']),
});

export const createSubscriptionSchema = z.object({
  plan: z.enum(['basic', 'pro']),
});

export const createStaffSubscriptionSchema = z.object({
  staffId: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id'),
  plan: z.enum(['basic', 'pro']),
});

export const paymentIdParamSchema = z.object({
  paymentId: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id'),
});
