import crypto from 'crypto';
import { Types } from 'mongoose';
import Customer from '../models/Customer';
import Booking from '../models/Booking';
import { ApiError } from '../utils/ApiError';
import { hashValue, compareValue } from '../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { consoleOtpProvider } from './otp/consoleOtpProvider';
import { ROLES } from '../types/roles';

// Swap this single line for a real SMS gateway provider (MSG91/Twilio/etc.)
// when going live — see docs/SAAS_SCALING.md. Everything else in this file
// is provider-agnostic.
const otpProvider = consoleOtpProvider;

const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function generateOtp(): string {
  // crypto.randomInt is CSPRNG-backed, unlike Math.random() — matters here
  // since guessing this code is the entire attack surface of this login flow.
  return crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

function issueTokens(customerId: string, salonId: string): AuthTokens {
  const accessToken = signAccessToken({ id: customerId, role: ROLES.CUSTOMER, salonId });
  const refreshToken = signRefreshToken({ id: customerId });
  return { accessToken, refreshToken };
}

async function persistRefreshToken(customerId: string, refreshToken: string) {
  const refreshTokenHash = await hashValue(refreshToken);
  await Customer.findByIdAndUpdate(customerId, { refreshTokenHash });
}

function sanitizeCustomer(customer: InstanceType<typeof Customer>) {
  return {
    id: String(customer._id),
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    isVerified: customer.isVerified,
  };
}

const MONGO_DUPLICATE_KEY_ERROR = 11000;

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: number }).code === MONGO_DUPLICATE_KEY_ERROR;
}

/** Finds-or-creates the CRM Customer record for a phone number — called on every booking (guest or logged-in) so every booking is always linked to a profile, and again here for OTP login. Does NOT verify identity by itself. */
export async function findOrCreateCustomer(salonId: Types.ObjectId, name: string, phone: string, email?: string) {
  const existing = await Customer.findOne({ salonId, phone });
  if (existing) {
    // Keep the profile fresh with whatever name/email the customer gives at
    // each booking, without requiring them to "edit their profile" separately.
    if (name && name !== existing.name) existing.name = name;
    if (email && email !== existing.email) existing.email = email;
    if (existing.isModified()) await existing.save();
    return existing;
  }

  try {
    return await Customer.create({ salonId, name, phone, email: email ?? '' });
  } catch (error) {
    // Two concurrent first-time bookings from the same phone number (e.g.
    // someone double-tapping "Confirm", or two of our own concurrency-test
    // requests) can both see "no existing customer" and race to create one —
    // the unique {salonId, phone} index correctly lets only one through.
    // The loser here just means "someone else already created it" — fetch
    // and use that one instead of failing the whole booking attempt.
    if (isDuplicateKeyError(error)) {
      const winner = await Customer.findOne({ salonId, phone });
      if (winner) return winner;
    }
    throw error;
  }
}

export async function requestOtp(salonId: Types.ObjectId, phone: string, name?: string) {
  const customer = await findOrCreateCustomer(salonId, name ?? 'Customer', phone);

  const withThrottle = await Customer.findById(customer._id).select('+otpLastSentAt');
  if (withThrottle?.otpLastSentAt && Date.now() - withThrottle.otpLastSentAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    throw ApiError.badRequest('Please wait a moment before requesting another code');
  }

  const otp = generateOtp();
  const otpHash = await hashValue(otp);

  await Customer.findByIdAndUpdate(customer._id, {
    otpHash,
    otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
    otpAttempts: 0,
    otpLastSentAt: new Date(),
  });

  await otpProvider.sendOtp(phone, otp);
}

export async function verifyOtp(salonId: Types.ObjectId, phone: string, otp: string) {
  const customer = await Customer.findOne({ salonId, phone }).select('+otpHash +otpExpiresAt +otpAttempts');
  if (!customer || !customer.otpHash || !customer.otpExpiresAt) {
    throw ApiError.badRequest('Please request a new code');
  }

  if (customer.otpExpiresAt.getTime() < Date.now()) {
    throw ApiError.badRequest('This code has expired — please request a new one');
  }

  if (customer.otpAttempts >= OTP_MAX_ATTEMPTS) {
    throw ApiError.badRequest('Too many incorrect attempts — please request a new code');
  }

  const matches = await compareValue(otp, customer.otpHash);
  if (!matches) {
    customer.otpAttempts += 1;
    await customer.save();
    throw ApiError.unauthorized('Incorrect code');
  }

  customer.otpHash = null;
  customer.otpExpiresAt = null;
  customer.otpAttempts = 0;
  customer.isVerified = true;
  await customer.save();

  const tokens = issueTokens(String(customer._id), String(salonId));
  await persistRefreshToken(String(customer._id), tokens.refreshToken);

  return { customer: sanitizeCustomer(customer), tokens };
}

export async function refreshCustomerSession(salonId: Types.ObjectId, refreshToken: string) {
  let payload: { id: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const customer = await Customer.findOne({ _id: payload.id, salonId }).select('+refreshTokenHash');
  if (!customer || !customer.refreshTokenHash) {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const matches = await compareValue(refreshToken, customer.refreshTokenHash);
  if (!matches) {
    customer.refreshTokenHash = null;
    await customer.save();
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const tokens = issueTokens(String(customer._id), String(salonId));
  await persistRefreshToken(String(customer._id), tokens.refreshToken);

  return { customer: sanitizeCustomer(customer), tokens };
}

export async function logoutCustomer(customerId: string) {
  await Customer.findByIdAndUpdate(customerId, { refreshTokenHash: null });
}

export async function getCustomerProfile(customerId: string, salonId: Types.ObjectId) {
  const customer = await Customer.findOne({ _id: customerId, salonId });
  if (!customer) throw ApiError.notFound('Customer not found');
  return sanitizeCustomer(customer);
}

export async function getCustomerBookings(customerId: string, salonId: Types.ObjectId) {
  return Booking.find({ customerId, salonId })
    .sort({ startTime: -1 })
    .populate('serviceId', 'name durationMinutes price')
    .populate('staffId', 'name');
}
