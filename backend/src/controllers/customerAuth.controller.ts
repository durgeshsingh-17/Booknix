import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler';
import * as customerAuthService from '../services/customerAuth.service';
import { env } from '../config/env';

const REFRESH_COOKIE_NAME = 'customerRefreshToken';

const refreshCookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'lax' as const,
  path: '/api/v1/customer-auth',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

export const requestOtp = asyncHandler(async (req: Request, res: Response) => {
  await customerAuthService.requestOtp(req.tenant!._id as unknown as Types.ObjectId, req.body.phone, req.body.name);
  res.json({ success: true, data: { message: 'Verification code sent' } });
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const { customer, tokens } = await customerAuthService.verifyOtp(req.tenant!._id as unknown as Types.ObjectId, req.body.phone, req.body.otp);
  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, refreshCookieOptions);
  res.json({ success: true, data: { customer, accessToken: tokens.accessToken } });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const tokenFromCookie = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  const tokenFromBody = req.body?.refreshToken as string | undefined;
  const refreshToken = tokenFromCookie ?? tokenFromBody;
  if (!refreshToken) {
    res.status(401).json({ success: false, message: 'Refresh token missing' });
    return;
  }
  const { customer, tokens } = await customerAuthService.refreshCustomerSession(req.tenant!._id as unknown as Types.ObjectId, refreshToken);
  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, refreshCookieOptions);
  res.json({ success: true, data: { customer, accessToken: tokens.accessToken } });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.authUser) {
    await customerAuthService.logoutCustomer(req.authUser.id);
  }
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/customer-auth' });
  res.json({ success: true, data: null });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const profile = await customerAuthService.getCustomerProfile(req.authUser!.id, req.tenant!._id as unknown as Types.ObjectId);
  res.json({ success: true, data: profile });
});

export const myBookings = asyncHandler(async (req: Request, res: Response) => {
  const bookings = await customerAuthService.getCustomerBookings(req.authUser!.id, req.tenant!._id as unknown as Types.ObjectId);
  res.json({ success: true, data: bookings });
});
