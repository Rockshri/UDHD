/**
 * fetchBaseQuery + reauth interceptor.
 *
 * Every request goes out with:
 *   - Authorization: Bearer <access-token from Redux> (added in prepareHeaders)
 *   - credentials: 'include'   (so the refresh cookie can flow on /auth/refresh)
 *
 * When a request comes back 401 we assume the access token expired,
 * fire ONE /auth/refresh call (shared across every concurrent 401 via
 * a promise lock — no thundering herd), then retry the original request
 * exactly once. If refresh also fails we clear credentials so the UI
 * can redirect to the login screen.
 */

import {
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import { env } from '../env';
import {
  clearCredentials,
  markUnauthenticated,
  setCredentials,
  type AuthState,
} from '../features/auth/authSlice';
import type { AuthResponse } from '../types/api';

interface StoreShape {
  auth: AuthState;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: env.VITE_API_BASE_URL,
  credentials: 'include',
  prepareHeaders: (headers, api) => {
    const token = (api.getState() as StoreShape).auth.accessToken;
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

/**
 * Shared promise so N concurrent 401s only trigger ONE refresh call.
 * Reset once the refresh completes (either way).
 */
let refreshInFlight: Promise<{ ok: boolean; data?: AuthResponse }> | null = null;

async function attemptRefresh(
  api: Parameters<BaseQueryFn>[1],
  extra: unknown,
): Promise<{ ok: boolean; data?: AuthResponse }> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const result = await rawBaseQuery(
      {
        url: 'auth/refresh',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {},
      },
      api,
      extra as FetchArgs['body'],
    );
    if (result.data) {
      return { ok: true, data: result.data as AuthResponse };
    }
    return { ok: false };
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

export const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status !== 401) {
    return result;
  }

  // Refresh endpoint itself failing shouldn't loop.
  const argUrl = typeof args === 'string' ? args : args.url;
  if (argUrl.endsWith('auth/refresh')) {
    api.dispatch(clearCredentials());
    return result;
  }

  const refreshed = await attemptRefresh(api, extraOptions);
  if (refreshed.ok && refreshed.data) {
    api.dispatch(
      setCredentials({
        user: refreshed.data.user,
        accessToken: refreshed.data.accessToken,
        accessTokenExpiresAt: refreshed.data.accessTokenExpiresAt,
      }),
    );
    result = await rawBaseQuery(args, api, extraOptions);
  } else {
    api.dispatch(markUnauthenticated());
    api.dispatch(clearCredentials());
  }
  return result;
};

/** Test hook — resets the module-level lock between test cases. */
export function __resetRefreshInFlight(): void {
  refreshInFlight = null;
}
