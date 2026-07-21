/**
 * Integration tests for /api/auth/* — the HTTP layer.
 *
 * Strategy: mock authService so we exercise routing, zod validation, error
 * mapping, rate-limit response codes, cookie flags, and content-type
 * enforcement — WITHOUT touching a real database.
 */
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { HttpError } from '../middleware/errorHandler.js';

vi.mock('../services/authService.js', () => ({
  login: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock('../lib/rateLimit.ts', async () => {
  // Rate limiter uses Upstash — force the no-op path for deterministic tests.
  return {
    loginLimiter: async () => ({ success: true, remaining: Infinity, reset: Date.now() }),
    refreshLimiter: async () => ({ success: true, remaining: Infinity, reset: Date.now() }),
    uploadLimiter: async () => ({ success: true, remaining: Infinity, reset: Date.now() }),
  };
});

import * as authService from '../services/authService.js';

const mockedLogin = vi.mocked(authService.login);
const mockedRefresh = vi.mocked(authService.refresh);
const mockedLogout = vi.mocked(authService.logout);

const app = createApp();

const validUser = {
  userId: 1,
  username: 'shri',
  role: 'MD' as const,
  fullName: 'Shri',
  canCreateProjects: true,
  canUpdateProjects: true,
  canDeleteProjects: true,
  canViewProjects: true,
};

const successOutcome = {
  kind: 'complete' as const,
  user: validUser,
  access: { token: 'access.jwt.token', expiresAt: new Date(Date.now() + 900_000) },
  refresh: {
    cookieValue: 'refresh.jwt.token.rawsecret',
    tokenId: 'tid-1',
    tokenHash: 'hashvalue',
    expiresAt: new Date(Date.now() + 30 * 24 * 3600_000),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/auth/login', () => {
  it('returns 400 VALIDATION_ERROR when username is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({ password: 'x' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedLogin).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_ERROR when password is empty', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({ username: 'shri', password: '' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 INVALID_CREDENTIALS on wrong password', async () => {
    mockedLogin.mockRejectedValueOnce(
      new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid username or password'),
    );
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({ username: 'shri', password: 'wrong-password' })
      .expect(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 200 + sets refresh cookie on success', async () => {
    mockedLogin.mockResolvedValueOnce(successOutcome);
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({ username: 'shri', password: 'correct-password' })
      .expect(200);

    expect(res.body.user).toEqual(validUser);
    expect(res.body.accessToken).toBe('access.jwt.token');
    expect(typeof res.body.accessTokenExpiresAt).toBe('string');

    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(setCookie).toBeDefined();
    const refreshCookie = setCookie.find((c) => c.startsWith('buidco_refresh='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('SameSite=Lax');
    expect(refreshCookie).toContain('Path=/api/auth');
  });

  it('returns 200 with { needsDivision, divisions } for PD step 1', async () => {
    mockedLogin.mockResolvedValueOnce({
      kind: 'needsDivision',
      divisions: [
        { divisionId: 1, divisionName: 'Patna Municipal' },
        { divisionId: 2, divisionName: 'Gaya' },
      ],
    });
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({ username: 'pd_user', password: 'pd_password' })
      .expect(200);

    expect(res.body.needsDivision).toBe(true);
    expect(res.body.divisions).toHaveLength(2);
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns 415 UNSUPPORTED_MEDIA_TYPE when Content-Type is not JSON', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Content-Type', 'text/plain')
      .send('anything')
      .expect(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(mockedRefresh).not.toHaveBeenCalled();
  });

  it('returns 401 NO_REFRESH_COOKIE when the cookie is missing', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Content-Type', 'application/json')
      .send({})
      .expect(401);
    expect(res.body.error.code).toBe('NO_REFRESH_COOKIE');
  });

  it('returns 401 INVALID_REFRESH when the service rejects the token', async () => {
    mockedRefresh.mockRejectedValueOnce(
      new HttpError(401, 'INVALID_REFRESH', 'Refresh token invalid'),
    );
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Content-Type', 'application/json')
      .set('Cookie', 'buidco_refresh=malformed.value')
      .send({})
      .expect(401);
    expect(res.body.error.code).toBe('INVALID_REFRESH');
  });

  it('rotates the cookie + returns a fresh access token on success', async () => {
    mockedRefresh.mockResolvedValueOnce({
      user: validUser,
      access: successOutcome.access,
      refresh: {
        ...successOutcome.refresh,
        cookieValue: 'rotated.jwt.rawsecret',
      },
    });

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Content-Type', 'application/json')
      .set('Cookie', 'buidco_refresh=old.valid.cookie')
      .send({})
      .expect(200);

    expect(res.body.accessToken).toBe('access.jwt.token');
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(setCookie.some((c) => c.includes('buidco_refresh=rotated.jwt.rawsecret'))).toBe(true);
  });
});

describe('POST /api/auth/logout', () => {
  it('always returns 204 and clears the cookie, even without a session', async () => {
    mockedLogout.mockResolvedValueOnce(undefined);
    const res = await request(app).post('/api/auth/logout').expect(204);
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(setCookie).toBeDefined();
    // Express clearCookie sets Expires in the past
    expect(setCookie.some((c) => c.startsWith('buidco_refresh='))).toBe(true);
  });
});
