import { api } from '../api';
import type { CosEotItem, CosEotUpsertPayload, ItemsResponse } from '../../types/api';

export const cosEotApi = api.injectEndpoints({
  endpoints: (build) => ({
    listCosEotForProject: build.query<ItemsResponse<CosEotItem>, string>({
      query: (projectId) => `projects/${projectId}/cos-eot`,
      providesTags: (_res, _err, projectId) => [{ type: 'CosEot', id: projectId }],
    }),
    createCosEot: build.mutation<
      CosEotItem,
      { projectId: string; body: CosEotUpsertPayload }
    >({
      query: ({ projectId, body }) => ({
        url: `projects/${projectId}/cos-eot`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: 'CosEot', id: arg.projectId },
        { type: 'Project', id: arg.projectId },
        'Kpis',
      ],
    }),
    updateCosEot: build.mutation<
      CosEotItem,
      { projectId: string; cosId: number; body: CosEotUpsertPayload }
    >({
      query: ({ projectId, cosId, body }) => ({
        url: `projects/${projectId}/cos-eot/${cosId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: 'CosEot', id: arg.projectId },
        { type: 'Project', id: arg.projectId },
        'Kpis',
      ],
    }),
    deleteCosEot: build.mutation<void, { projectId: string; cosId: number }>({
      query: ({ projectId, cosId }) => ({
        url: `projects/${projectId}/cos-eot/${cosId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: 'CosEot', id: arg.projectId },
        { type: 'Project', id: arg.projectId },
        'Kpis',
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListCosEotForProjectQuery,
  useCreateCosEotMutation,
  useUpdateCosEotMutation,
  useDeleteCosEotMutation,
} = cosEotApi;
