import { api } from '../api';
import type {
  ItemsResponse,
  MilestoneItem,
  MonthlyProgressItem,
  MonthlyProgressPayload,
  ReplaceMilestonesPayload,
} from '../../types/api';

export const milestonesApi = api.injectEndpoints({
  endpoints: (build) => ({
    listMilestones: build.query<ItemsResponse<MilestoneItem>, string>({
      query: (projectId) => `projects/${projectId}/milestones`,
      providesTags: (_res, _err, projectId) => [{ type: 'Milestone', id: projectId }],
    }),
    replaceMilestones: build.mutation<
      ItemsResponse<MilestoneItem>,
      { projectId: string; body: ReplaceMilestonesPayload }
    >({
      query: ({ projectId, body }) => ({
        url: `projects/${projectId}/milestones`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: 'Milestone', id: arg.projectId },
        { type: 'MilestoneHistory', id: arg.projectId },
        { type: 'PhysicalHistory', id: arg.projectId },
        { type: 'Project', id: arg.projectId },
        'Kpis',
      ],
    }),
    upsertMonthlyProgress: build.mutation<
      ItemsResponse<MonthlyProgressItem>,
      { projectId: string; body: MonthlyProgressPayload }
    >({
      query: ({ projectId, body }) => ({
        url: `projects/${projectId}/milestones/monthly-progress`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: 'MilestoneHistory', id: arg.projectId },
        { type: 'PhysicalHistory', id: arg.projectId },
        { type: 'Project', id: arg.projectId },
        'Kpis',
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListMilestonesQuery,
  useReplaceMilestonesMutation,
  useUpsertMonthlyProgressMutation,
} = milestonesApi;
