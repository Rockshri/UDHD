import { api } from '../api';
import type {
  CursorPage,
  ItemsResponse,
  MoM,
  MoMActionPoint,
  MoMActionPointUpsertPayload,
  MoMDetail,
  MoMUpsertPayload,
} from '../../types/api';

export interface ListMomQuery {
  limit?: number;
  cursor?: string;
  projectId?: string;
}

export const momApi = api.injectEndpoints({
  endpoints: (build) => ({
    listMom: build.query<CursorPage<MoM>, ListMomQuery | void>({
      query: (args) => ({ url: 'mom', params: (args ?? {}) as Record<string, unknown> }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((m) => ({ type: 'Mom', id: m.momId }) as const),
              { type: 'Mom' as const, id: 'LIST' },
            ]
          : [{ type: 'Mom' as const, id: 'LIST' }],
    }),
    getMom: build.query<MoMDetail, number>({
      query: (momId) => `mom/${momId}`,
      providesTags: (_res, _err, momId) => [{ type: 'Mom', id: momId }],
    }),
    createMom: build.mutation<MoM, MoMUpsertPayload>({
      query: (body) => ({ url: 'mom', method: 'POST', body }),
      invalidatesTags: [{ type: 'Mom', id: 'LIST' }],
    }),
    updateMom: build.mutation<MoM, { momId: number; body: MoMUpsertPayload }>({
      query: ({ momId, body }) => ({ url: `mom/${momId}`, method: 'PATCH', body }),
      invalidatesTags: (_res, _err, arg) => [
        { type: 'Mom', id: arg.momId },
        { type: 'Mom', id: 'LIST' },
      ],
    }),
    deleteMom: build.mutation<void, number>({
      query: (momId) => ({ url: `mom/${momId}`, method: 'DELETE' }),
      invalidatesTags: (_res, _err, momId) => [
        { type: 'Mom', id: momId },
        { type: 'Mom', id: 'LIST' },
      ],
    }),

    listMomActionPoints: build.query<ItemsResponse<MoMActionPoint>, number>({
      query: (momId) => `mom/${momId}/action-points`,
      providesTags: (_res, _err, momId) => [{ type: 'MomAction', id: momId }],
    }),
    createMomActionPoint: build.mutation<
      MoMActionPoint,
      { momId: number; body: MoMActionPointUpsertPayload }
    >({
      query: ({ momId, body }) => ({
        url: `mom/${momId}/action-points`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: 'MomAction', id: arg.momId },
        { type: 'Mom', id: arg.momId },
      ],
    }),
    updateMomActionPoint: build.mutation<
      MoMActionPoint,
      { momId: number; actionId: number; body: MoMActionPointUpsertPayload }
    >({
      query: ({ momId, actionId, body }) => ({
        url: `mom/${momId}/action-points/${actionId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: 'MomAction', id: arg.momId },
        { type: 'Mom', id: arg.momId },
      ],
    }),
    deleteMomActionPoint: build.mutation<void, { momId: number; actionId: number }>({
      query: ({ momId, actionId }) => ({
        url: `mom/${momId}/action-points/${actionId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: 'MomAction', id: arg.momId },
        { type: 'Mom', id: arg.momId },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListMomQuery,
  useGetMomQuery,
  useCreateMomMutation,
  useUpdateMomMutation,
  useDeleteMomMutation,
  useListMomActionPointsQuery,
  useCreateMomActionPointMutation,
  useUpdateMomActionPointMutation,
  useDeleteMomActionPointMutation,
} = momApi;
