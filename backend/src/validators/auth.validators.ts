import { z } from 'zod';

// Indian mobile numbers: exactly 10 digits, first digit 6-9 — matches the
// frontend's register-form validation (register.component.ts).
const indianMobileSchema = z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');

export const registerSalonSchema = z.object({
  salonName: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens'),
  subdomain: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Subdomain may only contain lowercase letters, numbers, and hyphens'),
  phone: indianMobileSchema,
  ownerName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});
