import { z } from 'zod';

// Indian mobile numbers: exactly 10 digits, first digit 6-9.
const indianMobileSchema = z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');

export const requestOtpSchema = z.object({
  phone: indianMobileSchema,
  // Optional — lets a first-time guest also set their display name while
  // requesting an OTP, so the Customer record isn't left with a blank name
  // if this is their very first interaction (no prior booking to source it from).
  name: z.string().min(2).max(120).optional(),
});

export const verifyOtpSchema = z.object({
  phone: indianMobileSchema,
  otp: z.string().length(6).regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

export const customerRefreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});
