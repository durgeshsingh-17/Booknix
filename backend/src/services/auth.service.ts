import mongoose from 'mongoose';
import Salon from '../models/Salon';
import User from '../models/User';
import { ROLES } from '../types/roles';
import { ApiError } from '../utils/ApiError';
import { hashValue, compareValue } from '../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { z } from 'zod';
import { registerSalonSchema } from '../validators/auth.validators';

type RegisterSalonInput = z.infer<typeof registerSalonSchema>;

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

function issueTokens(user: { id: string; role: string; salonId: string | null }): AuthTokens {
  const accessToken = signAccessToken({ id: user.id, role: user.role as never, salonId: user.salonId });
  const refreshToken = signRefreshToken({ id: user.id });
  return { accessToken, refreshToken };
}

/** Creates a new tenant (Salon) plus its owning salonAdmin user, atomically. */
export const registerSalon = async (input: RegisterSalonInput) => {
  const [existingSlug, existingSubdomain, existingEmail] = await Promise.all([
    Salon.findOne({ slug: input.slug }),
    Salon.findOne({ subdomain: input.subdomain }),
    User.findOne({ email: input.email.toLowerCase() }),
  ]);

  if (existingSlug) throw ApiError.conflict('This salon URL slug is already taken');
  if (existingSubdomain) throw ApiError.conflict('This subdomain is already taken');
  if (existingEmail) throw ApiError.conflict('An account with this email already exists');

  const session = await mongoose.startSession();
  try {
    let result!: { salon: InstanceType<typeof Salon>; user: InstanceType<typeof User> };
    await session.withTransaction(async () => {
      const createdSalons = await Salon.create(
        [
          {
            name: input.salonName,
            slug: input.slug,
            subdomain: input.subdomain,
            phone: input.phone,
            email: input.email.toLowerCase(),
          },
        ],
        { session },
      );
      const salon = createdSalons[0];
      if (!salon) throw ApiError.internal('Failed to create salon');

      const passwordHash = await hashValue(input.password);
      const createdUsers = await User.create(
        [
          {
            name: input.ownerName,
            email: input.email.toLowerCase(),
            passwordHash,
            role: ROLES.SALON_ADMIN,
            salonId: salon._id,
          },
        ],
        { session },
      );
      const user = createdUsers[0];
      if (!user) throw ApiError.internal('Failed to create salon owner account');

      salon.ownerUserId = user._id as never;
      await salon.save({ session });

      result = { salon, user };
    });

    const tokens = issueTokens({ id: String(result.user._id), role: result.user.role, salonId: String(result.salon._id) });
    await persistRefreshToken(String(result.user._id), tokens.refreshToken);

    return { salon: result.salon, user: sanitizeUser(result.user), tokens };
  } finally {
    await session.endSession();
  }
};

export const login = async (email: string, password: string) => {
  const user = await User.findOne({ email: email.toLowerCase(), isActive: true }).select('+passwordHash');
  if (!user) throw ApiError.unauthorized('Invalid email or password');

  const isValid = await compareValue(password, user.passwordHash);
  if (!isValid) throw ApiError.unauthorized('Invalid email or password');

  const tokens = issueTokens({ id: String(user._id), role: user.role, salonId: user.salonId ? String(user.salonId) : null });
  await persistRefreshToken(String(user._id), tokens.refreshToken);

  return { user: sanitizeUser(user), tokens };
};

export const refresh = async (refreshToken: string) => {
  let payload: { id: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await User.findById(payload.id).select('+refreshTokenHash');
  if (!user || !user.refreshTokenHash || !user.isActive) {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const matches = await compareValue(refreshToken, user.refreshTokenHash);
  if (!matches) {
    // Possible token reuse/theft — invalidate the stored token so the compromised token can't be replayed.
    user.refreshTokenHash = null;
    await user.save();
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const tokens = issueTokens({ id: String(user._id), role: user.role, salonId: user.salonId ? String(user.salonId) : null });
  await persistRefreshToken(String(user._id), tokens.refreshToken);

  return { user: sanitizeUser(user), tokens };
};

export const logout = async (userId: string) => {
  await User.findByIdAndUpdate(userId, { refreshTokenHash: null });
};

async function persistRefreshToken(userId: string, refreshToken: string) {
  const refreshTokenHash = await hashValue(refreshToken);
  await User.findByIdAndUpdate(userId, { refreshTokenHash });
}

function sanitizeUser(user: InstanceType<typeof User>) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    salonId: user.salonId ? String(user.salonId) : null,
  };
}
