import { useState } from 'react';
import { useGetLookupsQuery } from '../app/api/lookupsApi';
import { useListProjectsQuery, type ListProjectsQuery } from '../app/api/projectsApi';
import {
  downloadProjectsExport, type ExportFilters, type ExportFormat,
} from '../app/api/projectImportExportApi';
import { useAppSelector } from '../app/hooks';
import { selectAccessToken } from '../features/auth/authSlice';
import { ProjectsFilterBar } from '../components/projects/ProjectsFilterBar';
import { ProjectsTable } from '../components/projects/ProjectsTable';
import { Button } from '../components/ui/button';
import { HamburgerMenu, type MenuItem } from '../components/ui/HamburgerMenu';
import { Skeleton } from '../components/ui/skeleton';
import { useProjectFilters } from '../hooks/useProjectFilters';

const PAGE_SIZE = 50;

function buildQuery(f: ReturnType<typeof useProjectFilters>['filters'], cursor?: string): ListProjectsQuery {
  const q: ListProjectsQuery = { limit: PAGE_SIZE };
  if (cursor) q.cursor = cursor;
  if (f.search) q.search = f.search;
  if (f.status) q.status = f.status;
  if (f.projectStage) q.projectStage = f.projectStage;
  if (f.contractType) q.contractType = f.contractType;
  if (f.sectorId) q.sectorId = Number(f.sectorId);
  if (f.divisionId) q.divisionId = Number(f.divisionId);
  if (f.regionId) q.regionId = Number(f.regionId);
  if (f.schemeId) q.schemeId = Number(f.schemeId);
  return q;
}

/** Convert the on-screen filter state into the shape the export endpoint accepts. */
function toExportFilters(f: ReturnType<typeof useProjectFilters>['filters']): ExportFilters {
  const out: ExportFilters = {};
  if (f.search)       out.search       = f.search;
  if (f.status)       out.status       = f.status;
  if (f.projectStage) out.projectStage = f.projectStage;
  if (f.contractType) out.contractType = f.contractType;
  if (f.sectorId)     out.sectorId     = Number(f.sectorId);
  if (f.divisionId)   out.divisionId   = Number(f.divisionId);
  if (f.regionId)     out.regionId     = Number(f.regionId);
  if (f.schemeId)     out.schemeId     = Number(f.schemeId);
  return out;
}

export function ProjectsPage(): JSX.Element {
  const filterState = useProjectFilters();
  const { filters, activeCount } = filterState;
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const toggleOne = (projectId: string, next: boolean): void => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (next) n.add(projectId);
      else n.delete(projectId);
      return n;
    });
  };
  const toggleAllOnPage = (rowIds: string[], next: boolean): void => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (next) rowIds.forEach((id) => n.add(id));
      else rowIds.forEach((id) => n.delete(id));
      return n;
    });
  };
  const clearSelection = (): void => setSelectedIds(new Set());

  const accessToken = useAppSelector(selectAccessToken);
  const query = useListProjectsQuery(buildQuery(filters, cursor));
  const lookups = useGetLookupsQuery();

  const runExport = async (format: ExportFormat): Promise<void> => {
    setExportError(null);
    setExportBusy(true);
    try {
      await downloadProjectsExport({
        format, accessToken, filters: toExportFilters(filters),
      });
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setExportBusy(false);
    }
  };

  const runExportSelected = async (format: ExportFormat): Promise<void> => {
    if (selectedIds.size === 0) return;
    setExportError(null);
    setExportBusy(true);
    try {
      await downloadProjectsExport({
        format, accessToken, projectIds: Array.from(selectedIds),
      });
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setExportBusy(false);
    }
  };

  const rawItems = query.data?.items ?? [];
  const filteredItems = rawItems.filter((r) => {
    if (filters.priority && r.priority !== filters.priority) return false;
    return true;
  });

  // Build hamburger menu — Export-only per spec (Import + Template live on
  // Input Sheet). Adds "Export selected" section when a multi-select is
  // active so the choice is contextual.
  const selectionCount = selectedIds.size;
  const menuItems: MenuItem[] = [
    ...(selectionCount > 0
      ? [
          {
            type: 'submenu' as const,
            label: `✅  Export selected (${selectionCount})`,
            items: [
              { type: 'action' as const, label: 'Excel (.xlsx)',       onClick: () => void runExportSelected('xlsx') },
              { type: 'action' as const, label: 'PDF (.pdf)',           onClick: () => void runExportSelected('pdf') },
              { type: 'action' as const, label: 'PowerPoint (.pptx)',   onClick: () => void runExportSelected('pptx') },
            ],
          },
          { type: 'action' as const, label: `Clear selection (${selectionCount})`, onClick: clearSelection },
          { type: 'divider' as const },
        ]
      : []),
    {
      type: 'submenu' as const,
      label: '📤  Export current view',
      items: [
        { type: 'action', label: 'Excel (.xlsx)',     onClick: () => void runExport('xlsx') },
        { type: 'action', label: 'PDF (.pdf)',         onClick: () => void runExport('pdf') },
        { type: 'action', label: 'PowerPoint (.pptx)', onClick: () => void runExport('pptx') },
      ],
    },
  ];

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
          {query.isFetching || exportBusy ? (
            <span className="text-xs text-[#6B7280]">
              {exportBusy ? 'Preparing download…' : 'Loading…'}
            </span>
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
          <HamburgerMenu items={menuItems} align="end" ariaLabel="Projects actions" />
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
            selectedIds={selectedIds}
            onToggleOne={toggleOne}
            onToggleAllOnPage={toggleAllOnPage}
          />
          <div className="flex items-center justify-between text-xs text-[#6B7280]">
            <span>
              {cursor ? 'On next page — ' : 'Page 1 — '}
              showing {filteredItems.length} row{filteredItems.length === 1 ? '' : 's'}
              {selectionCount > 0 ? ` · ${selectionCount} selected across pages` : ''}.
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

      {exportError ? (
        <div role="alert" className="rounded border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-[12px] font-medium text-[#B91C1C]">
          {exportError}
          <button
            type="button"
            onClick={() => setExportError(null)}
            className="ml-2 text-[10px] font-bold uppercase tracking-wider text-[#7F1D1D] hover:underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
}
