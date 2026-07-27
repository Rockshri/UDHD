import { api } from '../api';
import type {
  CreatePasswordResetRequestPayload,
  CreatePasswordResetRequestResponse,
  RequestPasswordResetPayload,
  RequestPasswordResetResponse,
  ResetPasswordPayload,
  SendOtpPayload,
  VerifyOtpPayload,
  VerifyOtpResponse,
} from '../../types/api';

export const passwordResetApi = api.injectEndpoints({
  endpoints: (build) => ({
    requestPasswordReset: build.mutation<RequestPasswordResetResponse, RequestPasswordResetPayload>({
      query: (body) => ({ url: 'auth/request-password-reset', method: 'POST', body }),
    }),

    createPasswordResetRequest: build.mutation<CreatePasswordResetRequestResponse, CreatePasswordResetRequestPayload>({
      query: (body) => ({ url: 'auth/password-reset-requests', method: 'POST', body }),
    }),

    sendOtp: build.mutation<{ sent: true }, SendOtpPayload>({
      query: (body) => ({ url: 'auth/send-otp', method: 'POST', body }),
    }),

    verifyOtp: build.mutation<VerifyOtpResponse, VerifyOtpPayload>({
      query: (body) => ({ url: 'auth/verify-otp', method: 'POST', body }),
    }),

    resetPassword: build.mutation<void, ResetPasswordPayload>({
      query: (body) => ({ url: 'auth/reset-password', method: 'POST', body }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useRequestPasswordResetMutation,
  useCreatePasswordResetRequestMutation,
  useSendOtpMutation,
  useVerifyOtpMutation,
  useResetPasswordMutation,
} = passwordResetApi;
