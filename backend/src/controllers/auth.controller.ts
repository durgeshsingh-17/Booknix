import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as authService from '../services/auth.service';
import { env } from '../config/env';

const REFRESH_COOKIE_NAME = 'refreshToken';

const refreshCookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'lax' as const,
  path: '/api/v1/auth',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

export const registerSalon = asyncHandler(async (req: Request, res: Response) => {
  const { salon, user, tokens } = await authService.registerSalon(req.body);
  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, refreshCookieOptions);
  res.status(201).json({
    success: true,
    data: { salon: { id: salon._id, name: salon.name, slug: salon.slug, subdomain: salon.subdomain }, user, accessToken: tokens.accessToken },
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const { user, tokens } = await authService.login(email, password);
  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, refreshCookieOptions);
  res.json({ success: true, data: { user, accessToken: tokens.accessToken } });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const tokenFromCookie = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  const tokenFromBody = req.body?.refreshToken as string | undefined;
  const refreshToken = tokenFromCookie ?? tokenFromBody;
  if (!refreshToken) {
    res.status(401).json({ success: false, message: 'Refresh token missing' });
    return;
  }
  const { user, tokens } = await authService.refresh(refreshToken);
  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, refreshCookieOptions);
  res.json({ success: true, data: { user, accessToken: tokens.accessToken } });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.authUser) {
    await authService.logout(req.authUser.id);
  }
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
  res.json({ success: true, data: null });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: req.authUser });
});
