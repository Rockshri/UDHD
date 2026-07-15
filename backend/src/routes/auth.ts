import { Router, type Request, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import { REFRESH_COOKIE_NAME, refreshCookieOptions } from '../lib/cookies.js';
import { loginLimiter, refreshLimiter } from '../lib/rateLimit.js';
import { HttpError } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import * as authService from '../services/authService.js';

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1).max(60),
  password: z.string().min(1).max(200),
  /** Required only for PDs; step 2 of the 2-step PD login. */
  divisionId: z.number().int().positive().optional(),
});

function ipKey(req: Request): string {
  return req.ip ?? 'unknown';
}

function setSuccessResponse(
  res: Response,
  result: { user: authService.AuthenticatedUser; access: { token: string; expiresAt: Date }; refresh: { cookieValue: string } },
): void {
  res.cookie(REFRESH_COOKIE_NAME, result.refresh.cookieValue, refreshCookieOptions());
  res.json({
    user: result.user,
    accessToken: result.access.token,
    accessTokenExpiresAt: result.access.expiresAt.toISOString(),
  });
}

const rateLimit = (
  limiter: (key: string) => Promise<{ success: boolean; reset: number }>,
): RequestHandler =>
  async (req, res, next) => {
    try {
      const { success, reset } = await limiter(ipKey(req));
      if (!success) {
        res.setHeader('Retry-After', Math.max(0, Math.ceil((reset - Date.now()) / 1000)));
        throw new HttpError(429, 'RATE_LIMITED', 'Too many requests');
      }
      next();
    } catch (err) {
      next(err);
    }
  };

const requireJsonContentType: RequestHandler = (req, _res, next) => {
  const ct = req.get('content-type') ?? '';
  if (!ct.toLowerCase().includes('application/json')) {
    next(new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json'));
    return;
  }
  next();
};

authRouter.post(
  '/login',
  rateLimit(loginLimiter),
  async (req, res, next) => {
    try {
      const parsed = loginSchema.parse(req.body);
      const outcome = await authService.login(
        parsed.username,
        parsed.password,
        req,
        parsed.divisionId,
      );
      if (outcome.kind === 'needsDivision') {
        // Step 1 of PD login: credentials verified but division not yet
        // picked. Return the available divisions; client re-POSTs with the
        // chosen divisionId. No refresh cookie set until step 2.
        res.json({ needsDivision: true, divisions: outcome.divisions });
        return;
      }
      setSuccessResponse(res, outcome);
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post(
  '/refresh',
  requireJsonContentType,
  rateLimit(refreshLimiter),
  async (req, res, next) => {
    try {
      const cookieValue = req.cookies[REFRESH_COOKIE_NAME] as string | undefined;
      if (!cookieValue) {
        throw new HttpError(401, 'NO_REFRESH_COOKIE', 'Refresh cookie missing');
      }
      const result = await authService.refresh(cookieValue, req);
      setSuccessResponse(res, result);
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post('/logout', async (req, res, next) => {
  try {
    const cookieValue = req.cookies[REFRESH_COOKIE_NAME] as string | undefined;
    await authService.logout(cookieValue);
    const clear = refreshCookieOptions();
    res.clearCookie(REFRESH_COOKIE_NAME, {
      ...(clear.domain !== undefined ? { domain: clear.domain } : {}),
      path: clear.path,
      httpOnly: clear.httpOnly,
      secure: clear.secure,
      sameSite: clear.sameSite,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, (req, res) => {
  const user = req.user;
  if (!user) {
    // requireAuth guarantees this, but the type system doesn't know.
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    return;
  }
  res.json({ user });
});
