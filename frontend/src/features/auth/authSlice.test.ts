import { describe, expect, it } from 'vitest';
import {
  authReducer,
  clearCredentials,
  markUnauthenticated,
  setCredentials,
  selectAccessToken,
  selectAuthStatus,
  selectCurrentUser,
  selectHasRole,
  selectIsAuthenticated,
  type AuthState,
} from './authSlice';

const initial: AuthState = {
  user: null,
  accessToken: null,
  accessTokenExpiresAt: null,
  status: 'unknown',
  showMdBriefing: false,
};

const credentials = {
  user: {
    userId: 1,
    username: 'shri',
    role: 'MD' as const,
    fullName: 'Shri Test',
    canCreateProjects: true,
    canUpdateProjects: true,
    canDeleteProjects: true,
    canViewProjects: true,
  },
  accessToken: 'eyJ.access.token',
  accessTokenExpiresAt: '2026-07-04T12:00:00.000Z',
};

describe('authSlice reducers', () => {
  it('starts in unknown', () => {
    const s = authReducer(undefined, { type: '@@INIT' });
    expect(s.status).toBe('unknown');
    expect(s.user).toBeNull();
    expect(s.accessToken).toBeNull();
  });

  it('setCredentials moves to authenticated', () => {
    const s = authReducer(initial, setCredentials(credentials));
    expect(s.status).toBe('in');
    expect(s.user).toEqual(credentials.user);
    expect(s.accessToken).toBe(credentials.accessToken);
    expect(s.accessTokenExpiresAt).toBe(credentials.accessTokenExpiresAt);
  });

  it('clearCredentials wipes and moves to out', () => {
    const authed = authReducer(initial, setCredentials(credentials));
    const s = authReducer(authed, clearCredentials());
    expect(s.status).toBe('out');
    expect(s.user).toBeNull();
    expect(s.accessToken).toBeNull();
    expect(s.accessTokenExpiresAt).toBeNull();
  });

  it('markUnauthenticated flips unknown → out but leaves `in` alone', () => {
    const fromUnknown = authReducer(initial, markUnauthenticated());
    expect(fromUnknown.status).toBe('out');

    const authed = authReducer(initial, setCredentials(credentials));
    const stillAuthed = authReducer(authed, markUnauthenticated());
    expect(stillAuthed.status).toBe('in');
    expect(stillAuthed.user).toEqual(credentials.user);
  });
});

describe('authSlice selectors', () => {
  const shape = { auth: authReducer(initial, setCredentials(credentials)) };

  it('selectAccessToken returns the token', () => {
    expect(selectAccessToken(shape)).toBe(credentials.accessToken);
  });
  it('selectCurrentUser returns the user', () => {
    expect(selectCurrentUser(shape)).toEqual(credentials.user);
  });
  it('selectAuthStatus returns the status', () => {
    expect(selectAuthStatus(shape)).toBe('in');
  });
  it('selectIsAuthenticated reflects status === in', () => {
    expect(selectIsAuthenticated(shape)).toBe(true);
    expect(selectIsAuthenticated({ auth: initial })).toBe(false);
  });
  it('selectHasRole matches allowed roles', () => {
    expect(selectHasRole(shape, 'MD')).toBe(true);
    expect(selectHasRole(shape, 'MD', 'Admin')).toBe(true);
    expect(selectHasRole(shape, 'Viewer')).toBe(false);
    expect(selectHasRole({ auth: initial }, 'MD')).toBe(false);
  });
});
