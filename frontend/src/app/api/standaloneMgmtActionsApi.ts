import { api } from '../api';
import type { ItemsResponse } from '../../types/api';

export interface StandaloneMgmtAction {
  actionId: number;
  topic: string;
  status: 'Open' | 'Closed';
  deadlineDate: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface StandaloneMgmtActionUpsert {
  topic: string;
  status?: 'Open' | 'Closed';
  deadlineDate?: string | null;
}

const LIST_TAG = { type: 'MgmtAction' as const, id: 'STANDALONE_LIST' };

export const standaloneMgmtActionsApi = api.injectEndpoints({
  endpoints: (build) => ({
    listStandaloneActions: build.query<ItemsResponse<StandaloneMgmtAction>, void>({
      query: () => 'management-actions/standalone',
      providesTags: () => [LIST_TAG],
    }),
    createStandaloneAction: build.mutation<StandaloneMgmtAction, StandaloneMgmtActionUpsert>({
      query: (body) => ({ url: 'management-actions/standalone', method: 'POST', body }),
      invalidatesTags: () => [LIST_TAG],
    }),
    updateStandaloneAction: build.mutation<
      StandaloneMgmtAction,
      { actionId: number; body: Partial<StandaloneMgmtActionUpsert> }
    >({
      query: ({ actionId, body }) => ({
        url: `management-actions/standalone/${actionId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: () => [LIST_TAG],
    }),
    deleteStandaloneAction: build.mutation<void, number>({
      query: (actionId) => ({
        url: `management-actions/standalone/${actionId}`,
        method: 'DELETE',
      }),
      invalidatesTags: () => [LIST_TAG],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListStandaloneActionsQuery,
  useCreateStandaloneActionMutation,
  useUpdateStandaloneActionMutation,
  useDeleteStandaloneActionMutation,
} = standaloneMgmtActionsApi;
