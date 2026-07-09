import { api } from '../api';
import type { AuditAction, AuditItem, CursorPage } from '../../types/api';

export interface ListAuditQuery {
  limit?: number;
  cursor?: string;
  projectId?: string;
  userId?: number;
  action?: AuditAction;
}

export const auditApi = api.injectEndpoints({
  endpoints: (build) => ({
    listAudit: build.query<CursorPage<AuditItem>, ListAuditQuery | void>({
      query: (args) => ({ url: 'audit', params: (args ?? {}) as Record<string, unknown> }),
      providesTags: ['Audit'],
    }),
  }),
  overrideExisting: false,
});

export const { useListAuditQuery } = auditApi;
