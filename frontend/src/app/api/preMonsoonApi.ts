import { api } from '../api';
import type { ItemsResponse, PreMonsoonItem, PreMonsoonUpsertPayload } from '../../types/api';

export const preMonsoonApi = api.injectEndpoints({
  endpoints: (build) => ({
    listPreMonsoon: build.query<ItemsResponse<PreMonsoonItem>, void>({
      query: () => 'pre-monsoon',
      providesTags: ['PreMonsoon'],
    }),
    createPreMonsoon: build.mutation<PreMonsoonItem, PreMonsoonUpsertPayload>({
      query: (body) => ({ url: 'pre-monsoon', method: 'POST', body }),
      invalidatesTags: ['PreMonsoon'],
    }),
    updatePreMonsoon: build.mutation<PreMonsoonItem, { itemId: number; body: PreMonsoonUpsertPayload }>({
      query: ({ itemId, body }) => ({ url: `pre-monsoon/${itemId}`, method: 'PATCH', body }),
      invalidatesTags: ['PreMonsoon'],
    }),
    deletePreMonsoon: build.mutation<void, number>({
      query: (itemId) => ({ url: `pre-monsoon/${itemId}`, method: 'DELETE' }),
      invalidatesTags: ['PreMonsoon'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListPreMonsoonQuery,
  useCreatePreMonsoonMutation,
  useUpdatePreMonsoonMutation,
  useDeletePreMonsoonMutation,
} = preMonsoonApi;
