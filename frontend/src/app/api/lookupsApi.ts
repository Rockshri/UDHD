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

    // ── Sectors ─────────────────────────────────────────────────────────
    createSector: build.mutation<CreatedSector, { sectorName: string }>({
      query: (body) => ({ url: 'lookups/sectors', method: 'POST', body }),
      // Invalidate Lookups so every dropdown / summary page picks up the
      // new row. Kpis so the sector summary counts include a new row.
      invalidatesTags: ['Lookups', 'Kpis'],
    }),
    updateSector: build.mutation<CreatedSector, { sectorId: number; sectorName: string }>({
      query: ({ sectorId, sectorName }) => ({
        url: `lookups/sectors/${sectorId}`,
        method: 'PATCH',
        body: { sectorName },
      }),
      // Kpis + ProjectList too — the sector name shows up in project rows.
      invalidatesTags: ['Lookups', 'Kpis', { type: 'ProjectList', id: 'LIST' }],
    }),
    deleteSector: build.mutation<void, number>({
      query: (sectorId) => ({ url: `lookups/sectors/${sectorId}`, method: 'DELETE' }),
      invalidatesTags: ['Lookups', 'Kpis'],
    }),

    // ── Schemes ─────────────────────────────────────────────────────────
    createScheme: build.mutation<CreatedScheme, { schemeName: string }>({
      query: (body) => ({ url: 'lookups/schemes', method: 'POST', body }),
      invalidatesTags: ['Lookups', 'Kpis'],
    }),
    updateScheme: build.mutation<CreatedScheme, { schemeId: number; schemeName: string }>({
      query: ({ schemeId, schemeName }) => ({
        url: `lookups/schemes/${schemeId}`,
        method: 'PATCH',
        body: { schemeName },
      }),
      invalidatesTags: ['Lookups', 'Kpis', { type: 'ProjectList', id: 'LIST' }],
    }),
    deleteScheme: build.mutation<void, number>({
      query: (schemeId) => ({ url: `lookups/schemes/${schemeId}`, method: 'DELETE' }),
      invalidatesTags: ['Lookups', 'Kpis'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetLookupsQuery,
  useCreateSectorMutation,
  useUpdateSectorMutation,
  useDeleteSectorMutation,
  useCreateSchemeMutation,
  useUpdateSchemeMutation,
  useDeleteSchemeMutation,
} = lookupsApi;
