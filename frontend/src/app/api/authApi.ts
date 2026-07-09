import { api } from '../api';
import { clearCredentials, setCredentials } from '../../features/auth/authSlice';
import type { AuthResponse, LoginRequest, MeResponse } from '../../types/api';

export const authApi = api.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<AuthResponse, LoginRequest>({
      query: (body) => ({ url: 'auth/login', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(setCredentials(data));
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
