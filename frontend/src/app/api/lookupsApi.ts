import { api } from '../api';
import type { Lookups } from '../../types/api';

interface CreatedSector { sectorId: number; sectorName: string }
interface CreatedScheme { schemeId: number; schemeName: string }

export const lookupsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getLookups: build.query<Lookups, void>({
      query: () => 'lookups',
      providesTags: ['Lookups'],
      keepUnusedDataFor: 3600,
    }),
    createSector: build.mutation<CreatedSector, { sectorName: string }>({
      query: (body) => ({ url: 'lookups/sectors', method: 'POST', body }),
      // Invalidate Lookups so every dropdown / summary page picks up the
      // new row without a manual refresh.
      invalidatesTags: ['Lookups'],
    }),
    createScheme: build.mutation<CreatedScheme, { schemeName: string }>({
      query: (body) => ({ url: 'lookups/schemes', method: 'POST', body }),
      invalidatesTags: ['Lookups', 'Kpis'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetLookupsQuery,
  useCreateSectorMutation,
  useCreateSchemeMutation,
} = lookupsApi;
