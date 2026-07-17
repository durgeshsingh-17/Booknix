import { z } from 'zod';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'time must be HH:mm');
const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');
// Indian mobile numbers: exactly 10 digits, first digit 6-9 — matches the
// frontend's booking-form validation (book.component.ts) so a request that
// passed client-side checks never gets rejected here for a different reason.
const indianMobileSchema = z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');

export const availabilityQuerySchema = z.object({
  serviceId: objectId,
  date: dateSchema,
  staffId: objectId.optional(),
});

export const createBookingSchema = z.object({
  serviceId: objectId,
  staffId: objectId.optional(),
  date: dateSchema,
  time: timeSchema,
  customer: z.object({
    name: z.string().min(2).max(120),
    phone: indianMobileSchema,
    email: z.string().email().optional().default(''),
  }),
  notes: z.string().max(1000).optional().default(''),
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']),
});

export const lookupBookingQuerySchema = z.object({
  bookingId: objectId,
  token: z.string().min(32).max(64),
});

export const listBookingsQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']).optional(),
  staffId: objectId.optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
