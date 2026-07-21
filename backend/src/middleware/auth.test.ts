/**
 * Middleware tests for requireAuth, requireRole, and requireProject* gates.
 *
 * Strategy: build a minimal Express app that mounts each middleware on a
 * dummy route, mock authService.getUserById, sign real JWTs with the test
 * secrets, and assert status/error-code across roles.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signAccessToken } from '../lib/tokens.js';
import { errorHandler } from './errorHandler.js';
import {
  requireAuth,
  requireMd,
  requireProjectCreate,
  requireProjectDelete,
  requireRole,
  requireWriter,
} from './auth.js';

vi.mock('../services/authService.js', () => ({
  getUserById: vi.fn(),
}));

import * as authService from '../services/authService.js';

const mockedGetUserById = vi.mocked(authService.getUserById);

const baseUser = {
  userId: 42,
  username: 'demo',
  fullName: 'Demo User',
  canCreateProjects: false,
  canUpdateProjects: false,
  canDeleteProjects: false,
  canViewProjects: true,
};

function buildApp(middlewareChain: express.RequestHandler[]): express.Express {
  const app = express();
  app.get('/gated', ...middlewareChain, (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

function bearer(userId: number, role: 'MD' | 'Admin' | 'PD' | 'Viewer', extra: Record<string, unknown> = {}): string {
  const { token } = signAccessToken({
    sub: String(userId),
    role,
    name: 'x',
    ...extra,
  });
  return `Bearer ${token}`;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireAuth', () => {
  const app = buildApp([requireAuth]);

  it('401 UNAUTHENTICATED when Authorization header is missing', async () => {
    const res = await request(app).get('/gated').expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    expect(res.body.error.message).toContain('Missing bearer token');
  });

  it('401 UNAUTHENTICATED when the token is malformed', async () => {
    const res = await request(app)
      .get('/gated')
      .set('Authorization', 'Bearer not.a.jwt')
      .expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    expect(res.body.error.message).toContain('Invalid or expired');
  });

  it('401 UNAUTHENTICATED when the token is valid but the user is gone/inactive', async () => {
    mockedGetUserById.mockResolvedValueOnce(null);
    const res = await request(app)
      .get('/gated')
      .set('Authorization', bearer(42, 'Viewer'))
      .expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('200 with req.user populated when token + DB check pass', async () => {
    mockedGetUserById.mockResolvedValueOnce({
      ...baseUser,
      role: 'Viewer',
    });
    const res = await request(app)
      .get('/gated')
      .set('Authorization', bearer(42, 'Viewer'))
      .expect(200);
    expect(res.body.ok).toBe(true);
  });

  it('401 UNAUTHENTICATED for PD token missing divisionId claim', async () => {
    mockedGetUserById.mockResolvedValueOnce({
      ...baseUser,
      role: 'PD',
    });
    // Token intentionally has no divisionId claim.
    const res = await request(app)
      .get('/gated')
      .set('Authorization', bearer(42, 'PD'))
      .expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    expect(res.body.error.message).toContain('PD session');
  });
});

describe('requireRole / requireWriter / requireMd', () => {
  it('403 FORBIDDEN when a Viewer hits a Writer-only route', async () => {
    const app = buildApp([requireAuth, requireWriter]);
    mockedGetUserById.mockResolvedValueOnce({ ...baseUser, role: 'Viewer' });
    const res = await request(app)
      .get('/gated')
      .set('Authorization', bearer(42, 'Viewer'))
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('200 when an Admin hits a Writer-only route', async () => {
    const app = buildApp([requireAuth, requireWriter]);
    mockedGetUserById.mockResolvedValueOnce({ ...baseUser, role: 'Admin' });
    await request(app)
      .get('/gated')
      .set('Authorization', bearer(42, 'Admin'))
      .expect(200);
  });

  it('403 when an Admin hits an MD-only route', async () => {
    const app = buildApp([requireAuth, requireMd]);
    mockedGetUserById.mockResolvedValueOnce({ ...baseUser, role: 'Admin' });
    await request(app)
      .get('/gated')
      .set('Authorization', bearer(42, 'Admin'))
      .expect(403);
  });

  it('200 when an MD hits an MD-only route', async () => {
    const app = buildApp([requireAuth, requireMd]);
    mockedGetUserById.mockResolvedValueOnce({ ...baseUser, role: 'MD' });
    await request(app)
      .get('/gated')
      .set('Authorization', bearer(42, 'MD'))
      .expect(200);
  });

  it('requireRole throws when constructed with zero roles', () => {
    expect(() => requireRole()).toThrow(/at least one role/);
  });
});

describe('requireProjectCreate / requireProjectDelete gates', () => {
  it('MD bypasses granular flags even when canCreateProjects is false', async () => {
    const app = buildApp([requireAuth, requireProjectCreate]);
    mockedGetUserById.mockResolvedValueOnce({
      ...baseUser,
      role: 'MD',
      canCreateProjects: false,
    });
    await request(app)
      .get('/gated')
      .set('Authorization', bearer(42, 'MD'))
      .expect(200);
  });

  it('Viewer with canCreateProjects=true passes create gate', async () => {
    const app = buildApp([requireAuth, requireProjectCreate]);
    mockedGetUserById.mockResolvedValueOnce({
      ...baseUser,
      role: 'Viewer',
      canCreateProjects: true,
    });
    await request(app)
      .get('/gated')
      .set('Authorization', bearer(42, 'Viewer'))
      .expect(200);
  });

  it('Viewer with canCreateProjects=false is blocked at create gate', async () => {
    const app = buildApp([requireAuth, requireProjectCreate]);
    mockedGetUserById.mockResolvedValueOnce({
      ...baseUser,
      role: 'Viewer',
      canCreateProjects: false,
    });
    const res = await request(app)
      .get('/gated')
      .set('Authorization', bearer(42, 'Viewer'))
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN_CREATE');
  });

  it('Viewer with canDeleteProjects=false is blocked at delete gate', async () => {
    const app = buildApp([requireAuth, requireProjectDelete]);
    mockedGetUserById.mockResolvedValueOnce({
      ...baseUser,
      role: 'Viewer',
      canDeleteProjects: false,
    });
    const res = await request(app)
      .get('/gated')
      .set('Authorization', bearer(42, 'Viewer'))
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN_DELETE');
  });
});
