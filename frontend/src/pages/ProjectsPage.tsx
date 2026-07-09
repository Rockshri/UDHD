import { useState } from 'react';
import { useGetLookupsQuery } from '../app/api/lookupsApi';
import { useListProjectsQuery, type ListProjectsQuery } from '../app/api/projectsApi';
import { ProjectsFilterBar } from '../components/projects/ProjectsFilterBar';
import { ProjectsTable } from '../components/projects/ProjectsTable';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { useProjectFilters } from '../hooks/useProjectFilters';

const PAGE_SIZE = 50;

function buildQuery(f: ReturnType<typeof useProjectFilters>['filters'], cursor?: string): ListProjectsQuery {
  const q: ListProjectsQuery = { limit: PAGE_SIZE };
  if (cursor) q.cursor = cursor;
  if (f.search) q.search = f.search;
  if (f.status) q.status = f.status;
  if (f.projectStage) q.projectStage = f.projectStage;
  if (f.sectorId) q.sectorId = Number(f.sectorId);
  if (f.districtId) q.districtId = Number(f.districtId);
  if (f.schemeId) q.schemeId = Number(f.schemeId);
  return q;
}

export function ProjectsPage(): JSX.Element {
  const filterState = useProjectFilters();
  const { filters, activeCount } = filterState;
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  // Note: workType + priority filters aren't yet exposed by the backend list
  // endpoint — we apply them client-side over the current page.
  const query = useListProjectsQuery(buildQuery(filters, cursor));
  const lookups = useGetLookupsQuery();

  const rawItems = query.data?.items ?? [];
  const filteredItems = rawItems.filter((r) => {
    if (filters.workType && r.workType !== filters.workType) return false;
    if (filters.priority && r.priority !== filters.priority) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Projects Register</h1>
          <p className="mt-0.5 text-sm text-[#6B7280]">
            Every project managed by BUIDCO. Sort, filter, or click a row for the detail view.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {query.isFetching ? (
            <span className="text-xs text-[#6B7280]">Loading…</span>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCursor(undefined);
              void query.refetch();
            }}
          >
            ↻ Refresh
          </Button>
        </div>
      </header>

      <ProjectsFilterBar
        filters={filterState.filters}
        setFilter={(k, v) => {
          filterState.setFilter(k, v);
          setCursor(undefined);
        }}
        clearAll={() => {
          filterState.clearAll();
          setCursor(undefined);
        }}
        activeCount={activeCount}
        totalRows={filteredItems.length}
      />

      {query.isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : query.error ? (
        <div className="rounded border border-[#FCA5A5] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">
          Could not load projects. Try refresh.
        </div>
      ) : (
        <>
          <ProjectsTable
            rows={filteredItems}
            lookups={lookups.data}
            isFetching={query.isFetching}
          />
          <div className="flex items-center justify-between text-xs text-[#6B7280]">
            <span>
              {cursor ? 'On next page — ' : 'Page 1 — '}
              showing {filteredItems.length} row{filteredItems.length === 1 ? '' : 's'}.
            </span>
            <div className="flex items-center gap-2">
              {cursor ? (
                <Button variant="outline" size="sm" onClick={() => setCursor(undefined)}>
                  ← First page
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                disabled={!query.data?.nextCursor}
                onClick={() => setCursor(query.data?.nextCursor ?? undefined)}
              >
                Next page →
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
