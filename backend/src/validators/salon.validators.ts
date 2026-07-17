import { z } from 'zod';

// Indian mobile numbers: exactly 10 digits, first digit 6-9.
const indianMobileSchema = z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');

const workingHourSchema = z.object({
  day: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
  open: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  close: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  isClosed: z.boolean().default(false),
});

export const updateSalonSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: indianMobileSchema.optional(),
  email: z.string().email().optional(),
  address: z
    .object({
      street: z.string().max(200).optional(),
      city: z.string().max(100).optional(),
      state: z.string().max(100).optional(),
      zip: z.string().max(20).optional(),
    })
    .optional(),
  geo: z
    .object({
      lat: z.number().nullable().optional(),
      lng: z.number().nullable().optional(),
    })
    .optional(),
  googleMapsEmbedUrl: z.string().max(2000).optional(),
  workingHours: z.array(workingHourSchema).optional(),
  theme: z
    .object({
      logoUrl: z.string().optional(),
      primaryColor: z
        .string()
        .regex(/^#[0-9a-f]{6}$/i)
        .optional(),
      defaultMode: z.enum(['light', 'dark', 'system']).optional(),
    })
    .optional(),
});
