import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthUser } from '../types/express';

export type AccessTokenPayload = AuthUser;

export const signAccessToken = (payload: AccessTokenPayload): string => {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES_IN } as jwt.SignOptions);
};

export const signRefreshToken = (payload: { id: string }): string => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions);
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
};

export const verifyRefreshToken = (token: string): { id: string } => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as { id: string };
};
