import { api } from '../api';
import type {
  GeoPhoto,
  GeoPhotoUpdatePayload,
  GeoPhotoUrlCreatePayload,
  ItemsResponse,
} from '../../types/api';

export const geoPhotosApi = api.injectEndpoints({
  endpoints: (build) => ({
    listGeoPhotos: build.query<ItemsResponse<GeoPhoto>, string>({
      query: (projectId) => `projects/${projectId}/geo-photos`,
      providesTags: (_res, _err, projectId) => [{ type: 'GeoPhoto', id: projectId }],
    }),
    createGeoPhotoUrl: build.mutation<
      GeoPhoto,
      { projectId: string; body: GeoPhotoUrlCreatePayload }
    >({
      query: ({ projectId, body }) => ({
        url: `projects/${projectId}/geo-photos`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_res, _err, arg) => [{ type: 'GeoPhoto', id: arg.projectId }],
    }),
    updateGeoPhoto: build.mutation<
      GeoPhoto,
      { projectId: string; photoId: number; body: GeoPhotoUpdatePayload }
    >({
      query: ({ projectId, photoId, body }) => ({
        url: `projects/${projectId}/geo-photos/${photoId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_res, _err, arg) => [{ type: 'GeoPhoto', id: arg.projectId }],
    }),
    deleteGeoPhoto: build.mutation<void, { projectId: string; photoId: number }>({
      query: ({ projectId, photoId }) => ({
        url: `projects/${projectId}/geo-photos/${photoId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_res, _err, arg) => [{ type: 'GeoPhoto', id: arg.projectId }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListGeoPhotosQuery,
  useCreateGeoPhotoUrlMutation,
  useUpdateGeoPhotoMutation,
  useDeleteGeoPhotoMutation,
} = geoPhotosApi;
