import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useGetDivisionSummaryQuery,
  useGetRegionSummaryQuery,
} from '../app/api/kpisApi';
import { useGetLookupsQuery } from '../app/api/lookupsApi';
import {
  useListProjectsQuery, type ListProjectsQuery,
} from '../app/api/projectsApi';
import { ProjectsTable } from '../components/projects/ProjectsTable';
import { SummaryCard } from '../components/summary/SummaryCard';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../lib/utils';
import { formatPercent } from '../lib/formatters';

const CARD_COLORS = [
  '#1E3A5F', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#A5B4FC',
];

type SortKey = 'total' | 'delayed' | 'completion' | 'name';
type MetricFilter = 'total' | 'completed' | 'delayed';

const PROJECT_PAGE_SIZE = 25;

/**
 * Division-wise Summary (Phase B §7). Sibling to the District-wise Summary
 * page — reuses the same summary-card layout but groups the drill-in by
 * division and shows a region roll-up strip on top. Existing District page
 * remains unchanged per the user's "keep district, add division alongside".
 */
export function DivisionsPage(): JSX.Element {
  const navigate = useNavigate();
  const regions = useGetRegionSummaryQuery();
  const summary = useGetDivisionSummaryQuery();
  const lookups = useGetLookupsQuery();
  const [regionFilter, setRegionFilter] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [search, setSearch] = useState('');
  const [metricFilter, setMetricFilter] = useState<MetricFilter | null>(null);
  const [projectCursor, setProjectCursor] = useState<string | undefined>(undefined);

  const items = summary.data?.items ?? [];

  // Aggregate KPIs reflect the region chip when set — so the numbers on
  // the cards match whatever list they open. When no chip is active the
  // whole portfolio is shown.
  const regionScoped = useMemo(
    () => (regionFilter ? items.filter((d) => d.regionId === regionFilter) : items),
    [items, regionFilter],
  );
  const totals = useMemo(
    () => ({
      projects: regionScoped.reduce((s, r) => s + r.total, 0),
      completed: regionScoped.reduce((s, r) => s + r.completed, 0),
      delayed: regionScoped.reduce((s, r) => s + r.delayed, 0),
    }),
    [regionScoped],
  );

  // Any change to region or metric resets the paging cursor so we don't
  // keep a stale nextCursor from a different filtered set.
  const resetProjectPaging = (): void => setProjectCursor(undefined);

  const projectQueryArgs = useMemo<ListProjectsQuery>(() => {
    const q: ListProjectsQuery = { limit: PROJECT_PAGE_SIZE };
    if (projectCursor) q.cursor = projectCursor;
    if (regionFilter) q.regionId = regionFilter;
    if (metricFilter === 'completed') q.status = 'Completed';
    if (metricFilter === 'delayed') q.status = 'Delayed';
    return q;
  }, [metricFilter, projectCursor, regionFilter]);

  const projectList = useListProjectsQuery(projectQueryArgs, { skip: !metricFilter });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = regionFilter ? items.filter((d) => d.regionId === regionFilter) : items;
    if (term) list = list.filter((d) => d.divisionName.toLowerCase().includes(term));
    list = [...list].sort((a, b) => {
      if (sortKey === 'name') return a.divisionName.localeCompare(b.divisionName);
      if (sortKey === 'delayed') return b.delayed - a.delayed;
      if (sortKey === 'completion') {
        return (b.completionRatePct ?? -1) - (a.completionRatePct ?? -1);
      }
      return b.total - a.total;
    });
    return list;
  }, [items, search, sortKey, regionFilter]);

  return (
    <article className="space-y-4">
      <header>
        <h1 className="text-lg font-bold text-[#111827]">Division-wise Summary</h1>
        <p className="text-[12.5px] text-[#6B7280]">
          Click a region chip to focus, then a division card to drill in.
        </p>
      </header>

      {/* Region roll-up strip */}
      {regions.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {(regions.data?.items ?? []).map((r) => (
            <button
              key={r.regionId}
              type="button"
              onClick={() => {
                setRegionFilter(regionFilter === r.regionId ? null : r.regionId);
                resetProjectPaging();
              }}
              aria-pressed={regionFilter === r.regionId}
              className={cn(
                'flex items-center justify-between rounded-lg border p-3 text-left shadow-sm transition-all',
                regionFilter === r.regionId
                  ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white'
                  : 'border-[#E5E7EB] bg-white hover:-translate-y-0.5 hover:shadow-md',
              )}
            >
              <div>
                <div className={cn(
                  'text-[13px] font-bold',
                  regionFilter === r.regionId ? 'text-white' : 'text-[#111827]',
                )}>
                  {r.regionName}
                </div>
                <div className={cn(
                  'text-[11px]',
                  regionFilter === r.regionId ? 'text-[#93C5FD]' : 'text-[#6B7280]',
                )}>
                  {r.divisionCount} divisions · {r.total} projects
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className={cn(
                  'rounded-full px-2 py-0.5 font-bold',
                  regionFilter === r.regionId
                    ? 'bg-white/15 text-white'
                    : 'bg-[#DCFCE7] text-[#15803D]',
                )}>
                  ✓ {r.completed}
                </span>
                <span className={cn(
                  'rounded-full px-2 py-0.5 font-bold',
                  regionFilter === r.regionId
                    ? 'bg-white/15 text-white'
                    : 'bg-[#DBEAFE] text-[#1D4ED8]',
                )}>
                  ⟳ {r.inProgress}
                </span>
                <span className={cn(
                  'rounded-full px-2 py-0.5 font-bold',
                  regionFilter === r.regionId
                    ? 'bg-[#EF4444]/30 text-[#FCA5A5]'
                    : 'bg-[#FEE2E2] text-[#B91C1C]',
                )}>
                  ! {r.delayed}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <MetricButton
          label="Total projects"
          value={totals.projects}
          tone="brand"
          active={metricFilter === 'total'}
          onClick={() => {
            setMetricFilter((prev) => (prev === 'total' ? null : 'total'));
            resetProjectPaging();
          }}
        />
        <MetricButton
          label="Completed"
          value={totals.completed}
          tone="success"
          active={metricFilter === 'completed'}
          onClick={() => {
            setMetricFilter((prev) => (prev === 'completed' ? null : 'completed'));
            resetProjectPaging();
          }}
        />
        <MetricButton
          label="Delayed"
          value={totals.delayed}
          tone="danger"
          active={metricFilter === 'delayed'}
          onClick={() => {
            setMetricFilter((prev) => (prev === 'delayed' ? null : 'delayed'));
            resetProjectPaging();
          }}
        />
      </div>

      {metricFilter ? (
        <MetricProjectsPanel
          metric={metricFilter}
          regionName={
            regionFilter
              ? regions.data?.items.find((r) => r.regionId === regionFilter)?.regionName ?? null
              : null
          }
          isLoading={projectList.isFetching}
          rows={projectList.data?.items ?? []}
          total={projectList.data?.total}
          hasNext={Boolean(projectList.data?.nextCursor)}
          hasPrev={Boolean(projectCursor)}
          onFirst={() => setProjectCursor(undefined)}
          onNext={() => setProjectCursor(projectList.data?.nextCursor ?? undefined)}
          onClear={() => {
            setMetricFilter(null);
            resetProjectPaging();
          }}
          lookups={lookups.data}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: 'total', label: 'Sort: Total ↓' },
            { id: 'delayed', label: 'Sort: Delayed ↓' },
            { id: 'completion', label: 'Sort: Completion % ↓' },
            { id: 'name', label: 'Sort: A–Z' },
          ] satisfies Array<{ id: SortKey; label: string }>
        ).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSortKey(s.id)}
            className={cn(
              'rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors',
              sortKey === s.id
                ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white'
                : 'border-[#D1D5DB] bg-white text-[#6B7280] hover:text-[#374151]',
            )}
          >
            {s.label}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search division…"
          className="ml-auto h-8 w-64 rounded border border-[#D1D5DB] px-3 text-[12.5px]"
        />
      </div>

      {summary.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-[12.5px] text-[#6B7280]">
            {items.length === 0
              ? 'No divisions configured yet.'
              : 'No divisions match the current filter.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((row, idx) => (
            <SummaryCard
              key={row.divisionId}
              name={`${row.divisionName} · ${row.regionName}`}
              color={CARD_COLORS[idx % CARD_COLORS.length] ?? '#1E3A5F'}
              total={row.total}
              completed={row.completed}
              inProgress={row.inProgress}
              delayed={row.delayed}
              extraStat={
                row.completionRatePct !== null
                  ? { label: 'Completion', value: formatPercent(row.completionRatePct) }
                  : undefined
              }
              active={false}
              onClick={() => {
                // Client-side navigation (React Router) — full-page reloads
                // via window.location on Vercel used to 404 for anyone
                // without the SPA-fallback rewrite; navigate() is the
                // correct SPA pattern regardless of host config.
                navigate(`/projects?divisionId=${row.divisionId}`);
              }}
            />
          ))}
        </div>
      )}
    </article>
  );
}

function MetricButton({
  label, value, tone, active, onClick,
}: {
  label: string;
  value: number;
  tone: 'brand' | 'success' | 'danger';
  active: boolean;
  onClick: () => void;
}): JSX.Element {
  const palette: Record<typeof tone, { border: string; text: string; ring: string }> = {
    brand:   { border: 'border-t-[#1E3A5F]', text: 'text-[#1E3A5F]', ring: 'ring-[#1E3A5F]' },
    success: { border: 'border-t-[#15803D]', text: 'text-[#15803D]', ring: 'ring-[#15803D]' },
    danger:  { border: 'border-t-[#B91C1C]', text: 'text-[#B91C1C]', ring: 'ring-[#B91C1C]' },
  };
  const p = palette[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'group rounded border-t-4 border-x border-b border-[#E5E7EB] bg-white px-3 py-2 text-left shadow-sm transition-all',
        'hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1',
        p.border,
        p.ring,
        active ? 'ring-2 ring-offset-1' : '',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">
          {label}
        </div>
        {active ? (
          <span className="rounded-full bg-[#1E3A5F] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-white">
            Showing
          </span>
        ) : null}
      </div>
      <div className={cn('text-xl font-extrabold tabular-nums', p.text)}>{value}</div>
      <div className="mt-0.5 text-[10.5px] text-[#6B7280] group-hover:text-[#374151]">
        {active ? 'Click again to hide list' : 'Click to view projects'}
      </div>
    </button>
  );
}

interface MetricProjectsPanelProps {
  metric: MetricFilter;
  regionName: string | null;
  isLoading: boolean;
  rows: import('../types/api').ProjectListItem[];
  total?: number | undefined;
  hasNext: boolean;
  hasPrev: boolean;
  onFirst: () => void;
  onNext: () => void;
  onClear: () => void;
  lookups: import('../types/api').Lookups | undefined;
}

function MetricProjectsPanel({
  metric, regionName, isLoading, rows, total, hasNext, hasPrev,
  onFirst, onNext, onClear, lookups,
}: MetricProjectsPanelProps): JSX.Element {
  const title =
    metric === 'total' ? 'All projects' :
    metric === 'completed' ? 'Completed projects' :
    'Delayed projects';
  const scope = regionName ? `${regionName} region` : 'Portfolio-wide';

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F3F4F6] bg-[#F9FAFB] px-3 py-2">
        <div>
          <span className="text-[12px] font-bold text-[#111827]">{title}</span>
          <span className="ml-2 text-[11px] font-normal text-[#6B7280]">
            — {scope}
            {typeof total === 'number' ? ` · ${total} total` : ''}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear}>
          Hide list
        </Button>
      </div>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4">
            <Skeleton className="h-40 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-[12.5px] text-[#6B7280]">
            No projects match this view.
          </p>
        ) : (
          <>
            <ProjectsTable
              rows={rows}
              lookups={lookups}
              isFetching={isLoading}
            />
            <div className="flex items-center justify-between gap-2 border-t border-[#F3F4F6] px-3 py-2 text-[11px] text-[#6B7280]">
              <span>
                Showing {rows.length}
                {typeof total === 'number' ? ` of ${total}` : ''}
                {' '}project{rows.length === 1 ? '' : 's'}.
              </span>
              <div className="flex items-center gap-2">
                {hasPrev ? (
                  <Button variant="outline" size="sm" onClick={onFirst}>
                    ← First page
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" disabled={!hasNext} onClick={onNext}>
                  Next page →
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
