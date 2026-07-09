import { api } from '../api';
import type {
  CreateUserPayload,
  ItemsResponse,
  UpdateUserPayload,
  UserRow,
} from '../../types/api';

export const usersApi = api.injectEndpoints({
  endpoints: (build) => ({
    listUsers: build.query<ItemsResponse<UserRow>, void>({
      query: () => 'users',
      providesTags: ['User'],
    }),
    createUser: build.mutation<UserRow, CreateUserPayload>({
      query: (body) => ({ url: 'users', method: 'POST', body }),
      invalidatesTags: ['User'],
    }),
    updateUser: build.mutation<UserRow, { userId: number; body: UpdateUserPayload }>({
      query: ({ userId, body }) => ({ url: `users/${userId}`, method: 'PATCH', body }),
      invalidatesTags: ['User'],
    }),
  }),
  overrideExisting: false,
});

export const { useListUsersQuery, useCreateUserMutation, useUpdateUserMutation } = usersApi;
