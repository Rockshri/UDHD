import { api } from '../api';
import {
  clearCredentials,
  openMdBriefing,
  setCredentials,
} from '../../features/auth/authSlice';
import type {
  AuthResponse,
  LoginRequest,
  LoginResponse,
  MeResponse,
} from '../../types/api';

function isAuthResponse(r: LoginResponse): r is AuthResponse {
  return 'accessToken' in r;
}

export const authApi = api.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<LoginResponse, LoginRequest>({
      query: (body) => ({ url: 'auth/login', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // Only bind credentials + fire the MD briefing when we got a
          // full AuthResponse. The needsDivision case is step 1 of the
          // PD handshake — no session yet.
          if (isAuthResponse(data)) {
            dispatch(setCredentials(data));
            if (data.user.role === 'MD') {
              dispatch(openMdBriefing());
            }
          }
        } catch {
          /* leave auth state untouched — the error surfaces to the caller. */
        }
      },
      invalidatesTags: ['Auth'],
    }),

    /**
     * Explicit refresh. Base-query reauth handles the implicit case
     * (401 → refresh → retry). This mutation lets callers proactively
     * refresh (e.g. on app boot to hydrate the access token from the
     * still-valid refresh cookie).
     */
    refresh: build.mutation<AuthResponse, void>({
      query: () => ({
        url: 'auth/refresh',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {},
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(setCredentials(data));
        } catch {
          dispatch(clearCredentials());
        }
      },
    }),

    logout: build.mutation<void, void>({
      query: () => ({ url: 'auth/logout', method: 'POST' }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } finally {
          dispatch(clearCredentials());
        }
      },
      invalidatesTags: ['Auth'],
    }),

    me: build.query<MeResponse, void>({
      query: () => 'auth/me',
      providesTags: ['Auth'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useLoginMutation,
  useRefreshMutation,
  useLogoutMutation,
  useMeQuery,
  useLazyMeQuery,
} = authApi;
