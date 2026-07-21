import { api } from '../api';
import type {
  CursorPage,
  ItemsResponse,
  MilestoneHistoryPoint,
  PhysicalHistoryPoint,
  ProjectDetail,
  ProjectListItem,
  ProjectUpsertPayload,
  TenderSubStage,
} from '../../types/api';

export interface TenderTransferPayload {
  projectIds: string[];
  direction: 'next' | 'prev';
}

export interface TenderTransferResponse {
  moved: Array<{ projectId: string; from: TenderSubStage; to: TenderSubStage }>;
  skipped: Array<{ projectId: string; reason: string }>;
}

export interface ListProjectsQuery {
  limit?: number;
  cursor?: string;
  status?: string;
  /** Filters on the new project_stage_v2 column (Phase A §3.2). */
  projectStage?: string;
  contractType?: string;
  districtId?: number;
  divisionId?: number;
  regionId?: number;
  sectorId?: number;
  schemeId?: number;
  search?: string;
}

export const projectsApi = api.injectEndpoints({
  endpoints: (build) => ({
    listProjects: build.query<CursorPage<ProjectListItem>, ListProjectsQuery | void>({
      query: (args) => ({ url: 'projects', params: (args ?? {}) as Record<string, unknown> }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(
                (p) => ({ type: 'Project', id: p.projectId }) as const,
              ),
              { type: 'ProjectList' as const, id: 'LIST' },
            ]
          : [{ type: 'ProjectList' as const, id: 'LIST' }],
    }),

    getProject: build.query<ProjectDetail, string>({
      query: (projectId) => `projects/${projectId}`,
      providesTags: (_res, _err, projectId) => [{ type: 'Project', id: projectId }],
    }),

    createProject: build.mutation<ProjectDetail, ProjectUpsertPayload>({
      query: (body) => ({ url: 'projects', method: 'POST', body }),
      invalidatesTags: [{ type: 'ProjectList', id: 'LIST' }, 'Kpis'],
    }),

    updateProject: build.mutation<
      ProjectDetail,
      { projectId: string; body: ProjectUpsertPayload }
    >({
      query: ({ projectId, body }) => ({ url: `projects/${projectId}`, method: 'PATCH', body }),
      invalidatesTags: (_res, _err, arg) => [
        { type: 'Project', id: arg.projectId },
        { type: 'ProjectList', id: 'LIST' },
        'Kpis',
      ],
      // Optimistic update — reflect the patch immediately, roll back on error.
      async onQueryStarted({ projectId, body }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          projectsApi.util.updateQueryData('getProject', projectId, (draft) => {
            Object.assign(draft, body);
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),

    deleteProject: build.mutation<void, string>({
      query: (projectId) => ({ url: `projects/${projectId}`, method: 'DELETE' }),
      invalidatesTags: (_res, _err, projectId) => [
        { type: 'Project', id: projectId },
        { type: 'ProjectList', id: 'LIST' },
        'Kpis',
        'Audit',
      ],
    }),

    getPhysicalHistory: build.query<ItemsResponse<PhysicalHistoryPoint>, string>({
      query: (projectId) => `projects/${projectId}/physical-history`,
      providesTags: (_res, _err, projectId) => [{ type: 'PhysicalHistory', id: projectId }],
    }),

    getMilestoneHistory: build.query<ItemsResponse<MilestoneHistoryPoint>, string>({
      query: (projectId) => `projects/${projectId}/milestone-history`,
      providesTags: (_res, _err, projectId) => [{ type: 'MilestoneHistory', id: projectId }],
    }),

    /**
     * Tender_Dashboard.md §7 — bulk-advance/reverse selected projects in
     * the tender workflow. Response reports both `moved` and `skipped`
     * so the modal can show partial-success details.
     */
    transferTender: build.mutation<TenderTransferResponse, TenderTransferPayload>({
      query: (body) => ({ url: 'projects/tender-transfer', method: 'POST', body }),
      invalidatesTags: (res) => {
        const tags: Array<
          { type: 'Project'; id: string } | { type: 'ProjectList'; id: 'LIST' } | 'Kpis' | 'Audit'
        > = [{ type: 'ProjectList', id: 'LIST' }, 'Kpis', 'Audit'];
        for (const m of res?.moved ?? []) {
          tags.push({ type: 'Project', id: m.projectId });
        }
        return tags;
      },
    }),
  }),
  overrideExisting: false,
});

export const {
  useListProjectsQuery,
  useLazyListProjectsQuery,
  useGetProjectQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  useGetPhysicalHistoryQuery,
  useGetMilestoneHistoryQuery,
  useTransferTenderMutation,
} = projectsApi;
