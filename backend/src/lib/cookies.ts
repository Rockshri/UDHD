import type { CookieOptions } from 'express';
import { env, isProduction } from '../env.js';

export const REFRESH_COOKIE_NAME = 'buidco_refresh';

export function refreshCookieOptions(): CookieOptions {
  const opts: CookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: env.REFRESH_TOKEN_TTL_SECONDS * 1000,
  };
  if (env.COOKIE_DOMAIN) {
    opts.domain = env.COOKIE_DOMAIN;
  }
  return opts;
}
