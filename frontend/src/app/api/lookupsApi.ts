import { api } from '../api';
import type { Lookups } from '../../types/api';

export const lookupsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getLookups: build.query<Lookups, void>({
      query: () => 'lookups',
      providesTags: ['Lookups'],
      keepUnusedDataFor: 3600,
    }),
  }),
  overrideExisting: false,
});

export const { useGetLookupsQuery } = lookupsApi;
