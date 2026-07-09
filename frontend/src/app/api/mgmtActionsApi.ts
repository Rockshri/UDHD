import { api } from '../api';
import type { ItemsResponse, MgmtActionItem, MgmtActionUpsertPayload } from '../../types/api';

export const mgmtActionsApi = api.injectEndpoints({
  endpoints: (build) => ({
    listMgmtActionsForProject: build.query<ItemsResponse<MgmtActionItem>, string>({
      query: (projectId) => `projects/${projectId}/management-actions`,
      providesTags: (_res, _err, projectId) => [{ type: 'MgmtAction', id: projectId }],
    }),
    createMgmtAction: build.mutation<
      MgmtActionItem,
      { projectId: string; body: MgmtActionUpsertPayload }
    >({
      query: ({ projectId, body }) => ({
        url: `projects/${projectId}/management-actions`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: 'MgmtAction', id: arg.projectId },
        'Kpis',
      ],
    }),
    updateMgmtAction: build.mutation<
      MgmtActionItem,
      { projectId: string; itemId: number; body: MgmtActionUpsertPayload }
    >({
      query: ({ projectId, itemId, body }) => ({
        url: `projects/${projectId}/management-actions/${itemId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: 'MgmtAction', id: arg.projectId },
        'Kpis',
      ],
    }),
    deleteMgmtAction: build.mutation<void, { projectId: string; itemId: number }>({
      query: ({ projectId, itemId }) => ({
        url: `projects/${projectId}/management-actions/${itemId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: 'MgmtAction', id: arg.projectId },
        'Kpis',
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListMgmtActionsForProjectQuery,
  useCreateMgmtActionMutation,
  useUpdateMgmtActionMutation,
  useDeleteMgmtActionMutation,
} = mgmtActionsApi;
