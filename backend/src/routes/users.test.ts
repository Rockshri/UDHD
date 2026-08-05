/**
 * Integration tests for /api/users/* — the HTTP layer.
 *
 * Strategy: mock usersService (business logic) and authService.getUserById
 * (auth middleware) so we exercise routing, auth gating, validation, and
 * error mapping — without a real DB. This covers the DELETE endpoint added
 * with the delete-user feature: role gating (MD vs Admin), self-deletion
 * guard, and 404 for unknown users all live in the service, so we assert
 * the route surfaces those errors correctly.
 */
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { signAccessToken } from '../lib/tokens.js';
import { HttpError } from '../middleware/errorHandler.js';

// Mock the users service — every route delegates here.
vi.mock('../services/usersService.js', () => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  // Schemas are consumed by the routes; keep them real by re-importing.
  createUserSchema: (globalThis as { __realCreate?: unknown }).__realCreate,
  updateUserSchema: (globalThis as { __realUpdate?: unknown }).__realUpdate,
}));

// The auth middleware calls this — mock it to control which user each
// request "authenticates as".
vi.mock('../services/authService.js', () => ({
  getUserById: vi.fn(),
}));

import * as usersService from '../services/usersService.js';
import * as authService from '../services/authService.js';

const mockedDelete = vi.mocked(usersService.deleteUser);
const mockedGetUserById = vi.mocked(authService.getUserById);

const app = createApp();

/** Baseline user shape returned by getUserById for the auth middleware. */
const baseUser = {
  userId: 42,
  username: 'demo',
  fullName: 'Demo User',
  canCreateProjects: false,
  canUpdateProjects: false,
  canDeleteProjects: false,
  canViewProjects: true,
};

function bearer(
  userId: number,
  role: 'MD' | 'Admin' | 'PD' | 'Viewer',
): string {
  const { token } = signAccessToken({
    sub: String(userId),
    role,
    name: 'x',
  });
  return `Bearer ${token}`;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DELETE /api/users/:userId — auth gating', () => {
  it('401 UNAUTHENTICATED when Authorization header is missing', async () => {
    const res = await request(app).delete('/api/users/99').expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    expect(mockedDelete).not.toHaveBeenCalled();
  });

  it('403 FORBIDDEN when a Viewer attempts to delete', async () => {
    mockedGetUserById.mockResolvedValueOnce({ ...baseUser, role: 'Viewer' });
    const res = await request(app)
      .delete('/api/users/99')
      .set('Authorization', bearer(42, 'Viewer'))
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(mockedDelete).not.toHaveBeenCalled();
  });

  it('403 FORBIDDEN when a PD attempts to delete (PD is not a writer)', async () => {
    // PD tokens still need a divisionId for requireAuth to accept them,
    // but requireWriter runs before divisionId matters here — actually
    // requireAuth checks divisionId first, so PD without divisionId 401s.
    // Sign token WITH divisionId so we get past requireAuth to hit
    // requireWriter and prove the role gate blocks PDs.
    mockedGetUserById.mockResolvedValueOnce({ ...baseUser, role: 'PD' });
    const { token } = signAccessToken({
      sub: '42',
      role: 'PD',
      name: 'x',
      divisionId: 1,
    });
    const res = await request(app)
      .delete('/api/users/99')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(mockedDelete).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/users/:userId — validation + delegation', () => {
  it('400 when userId path param is not a positive integer', async () => {
    mockedGetUserById.mockResolvedValueOnce({ ...baseUser, role: 'MD' });
    const res = await request(app)
      .delete('/api/users/not-a-number')
      .set('Authorization', bearer(42, 'MD'))
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockedDelete).not.toHaveBeenCalled();
  });

  it('200 + delegates to service.deleteUser when MD deletes a valid target', async () => {
    mockedGetUserById.mockResolvedValueOnce({ ...baseUser, role: 'MD' });
    mockedDelete.mockResolvedValueOnce({ userId: 77 });

    const res = await request(app)
      .delete('/api/users/77')
      .set('Authorization', bearer(42, 'MD'))
      .expect(200);

    expect(res.body).toEqual({ userId: 77 });
    expect(mockedDelete).toHaveBeenCalledTimes(1);
    // (userId, actor) — actor.userId=42, role=MD
    expect(mockedDelete).toHaveBeenCalledWith(
      77,
      expect.objectContaining({ userId: 42, role: 'MD' }),
    );
  });

  it('200 when an Admin deletes a Viewer/PD (service allows)', async () => {
    mockedGetUserById.mockResolvedValueOnce({ ...baseUser, role: 'Admin' });
    mockedDelete.mockResolvedValueOnce({ userId: 55 });

    const res = await request(app)
      .delete('/api/users/55')
      .set('Authorization', bearer(42, 'Admin'))
      .expect(200);

    expect(res.body).toEqual({ userId: 55 });
    expect(mockedDelete).toHaveBeenCalledWith(
      55,
      expect.objectContaining({ userId: 42, role: 'Admin' }),
    );
  });
});

describe('DELETE /api/users/:userId — service-level error surfacing', () => {
  it('403 ADMIN_CANNOT_DELETE_HIGHER when Admin targets an MD (service throws)', async () => {
    mockedGetUserById.mockResolvedValueOnce({ ...baseUser, role: 'Admin' });
    mockedDelete.mockRejectedValueOnce(
      new HttpError(
        403,
        'ADMIN_CANNOT_DELETE_HIGHER',
        'Admin accounts can only delete Viewer or PD users.',
      ),
    );

    const res = await request(app)
      .delete('/api/users/10')
      .set('Authorization', bearer(42, 'Admin'))
      .expect(403);

    expect(res.body.error.code).toBe('ADMIN_CANNOT_DELETE_HIGHER');
    expect(res.body.error.message).toContain('Admin');
  });

  it('400 CANNOT_DELETE_SELF when MD tries to delete themselves', async () => {
    mockedGetUserById.mockResolvedValueOnce({ ...baseUser, role: 'MD' });
    mockedDelete.mockRejectedValueOnce(
      new HttpError(400, 'CANNOT_DELETE_SELF', "You can't delete your own account."),
    );

    const res = await request(app)
      .delete('/api/users/42')
      .set('Authorization', bearer(42, 'MD'))
      .expect(400);

    expect(res.body.error.code).toBe('CANNOT_DELETE_SELF');
  });

  it('404 USER_NOT_FOUND when the target does not exist', async () => {
    mockedGetUserById.mockResolvedValueOnce({ ...baseUser, role: 'MD' });
    mockedDelete.mockRejectedValueOnce(
      new HttpError(404, 'USER_NOT_FOUND', 'User 999 does not exist'),
    );

    const res = await request(app)
      .delete('/api/users/999')
      .set('Authorization', bearer(42, 'MD'))
      .expect(404);

    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });
});
