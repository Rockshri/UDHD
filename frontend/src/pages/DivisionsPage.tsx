import { useMemo, useState } from 'react';
import {
  useGetDivisionSummaryQuery,
  useGetRegionSummaryQuery,
} from '../app/api/kpisApi';
import { DrillTable } from '../components/summary/DrillTable';
import { SummaryCard } from '../components/summary/SummaryCard';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../lib/utils';
import { formatPercent } from '../lib/formatters';

const CARD_COLORS = [
  '#1E3A5F', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#A5B4FC',
];

type SortKey = 'total' | 'delayed' | 'completion' | 'name';

/** The four portfolio-metric blocks (Task 2) — each drills into the
 *  matching slice of projects, shown below the blocks. */
type MetricKey = 'divisionsWithProjects' | 'totalProjects' | 'completed' | 'delayed';

const METRIC_LABELS: Record<MetricKey, string> = {
  divisionsWithProjects: 'All projects — divisions with projects',
  totalProjects: 'All projects',
  completed: 'Completed projects',
  delayed: 'Delayed projects',
};

const METRIC_STATUS: Partial<Record<MetricKey, string>> = {
  completed: 'Completed',
  delayed: 'Delayed',
};

/**
 * Division-wise Summary (Phase B §7). Sibling to the District-wise Summary
 * page — reuses the same summary-card layout but groups the drill-in by
 * division and shows a region roll-up strip on top. Existing District page
 * remains unchanged per the user's "keep district, add division alongside".
 */
export function DivisionsPage(): JSX.Element {
  const regions = useGetRegionSummaryQuery();
  const summary = useGetDivisionSummaryQuery();
  const [regionFilter, setRegionFilter] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [search, setSearch] = useState('');
  const [activeMetric, setActiveMetric] = useState<MetricKey | null>(null);

  // Task 3 — Filter panel, applied together with (not instead of) sorting
  // and the existing region/search filters above.
  const [filterOpen, setFilterOpen] = useState(false);
  const [onlyWithProjects, setOnlyWithProjects] = useState(false);
  const [onlyWithDelayed, setOnlyWithDelayed] = useState(false);
  const [minCompletionPct, setMinCompletionPct] = useState('');
  const activeFilterCount =
    (onlyWithProjects ? 1 : 0) + (onlyWithDelayed ? 1 : 0) + (minCompletionPct.trim() ? 1 : 0);

  const items = summary.data?.items ?? [];

  const totals = useMemo(
    () => ({
      divisions: items.filter((d) => d.total > 0).length,
      projects: items.reduce((s, r) => s + r.total, 0),
      completed: items.reduce((s, r) => s + r.completed, 0),
      delayed: items.reduce((s, r) => s + r.delayed, 0),
    }),
    [items],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const minCompletion = minCompletionPct.trim() ? Number(minCompletionPct) : null;
    let list = regionFilter ? items.filter((d) => d.regionId === regionFilter) : items;
    if (term) list = list.filter((d) => d.divisionName.toLowerCase().includes(term));
    if (onlyWithProjects) list = list.filter((d) => d.total > 0);
    if (onlyWithDelayed) list = list.filter((d) => d.delayed > 0);
    if (minCompletion !== null && Number.isFinite(minCompletion)) {
      list = list.filter((d) => (d.completionRatePct ?? -1) >= minCompletion);
    }
    list = [...list].sort((a, b) => {
      if (sortKey === 'name') return a.divisionName.localeCompare(b.divisionName);
      if (sortKey === 'delayed') return b.delayed - a.delayed;
      if (sortKey === 'completion') {
        return (b.completionRatePct ?? -1) - (a.completionRatePct ?? -1);
      }
      return b.total - a.total;
    });
    return list;
  }, [items, search, sortKey, regionFilter, onlyWithProjects, onlyWithDelayed, minCompletionPct]);

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
              onClick={() =>
                setRegionFilter(regionFilter === r.regionId ? null : r.regionId)
              }
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

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Metric
          label="Divisions with projects"
          value={totals.divisions}
          tone="brand"
          active={activeMetric === 'divisionsWithProjects'}
          onClick={() =>
            setActiveMetric((k) => (k === 'divisionsWithProjects' ? null : 'divisionsWithProjects'))
          }
        />
        <Metric
          label="Total projects"
          value={totals.projects}
          tone="brand"
          active={activeMetric === 'totalProjects'}
          onClick={() => setActiveMetric((k) => (k === 'totalProjects' ? null : 'totalProjects'))}
        />
        <Metric
          label="Completed"
          value={totals.completed}
          tone="success"
          active={activeMetric === 'completed'}
          onClick={() => setActiveMetric((k) => (k === 'completed' ? null : 'completed'))}
        />
        <Metric
          label="Delayed"
          value={totals.delayed}
          tone="danger"
          active={activeMetric === 'delayed'}
          onClick={() => setActiveMetric((k) => (k === 'delayed' ? null : 'delayed'))}
        />
      </div>

      {activeMetric ? (
        <DrillTable
          {...(METRIC_STATUS[activeMetric] ? { status: METRIC_STATUS[activeMetric] } : {})}
          labelOfContext={METRIC_LABELS[activeMetric]}
          onClose={() => setActiveMetric(null)}
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
        <div className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            aria-pressed={filterOpen}
            aria-expanded={filterOpen}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors',
              filterOpen || activeFilterCount > 0
                ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white'
                : 'border-[#D1D5DB] bg-white text-[#6B7280] hover:text-[#374151]',
            )}
          >
            ▾ Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
          {filterOpen ? (
            <div className="absolute left-0 top-full z-20 mt-1.5 w-72 rounded-lg border border-[#E5E7EB] bg-white p-3 shadow-lg">
              <div className="space-y-2.5">
                <label className="flex items-center gap-2 text-[12px] text-[#374151]">
                  <input
                    type="checkbox"
                    checked={onlyWithProjects}
                    onChange={(e) => setOnlyWithProjects(e.target.checked)}
                    className="cursor-pointer accent-[#1E3A5F]"
                  />
                  Only divisions with projects
                </label>
                <label className="flex items-center gap-2 text-[12px] text-[#374151]">
                  <input
                    type="checkbox"
                    checked={onlyWithDelayed}
                    onChange={(e) => setOnlyWithDelayed(e.target.checked)}
                    className="cursor-pointer accent-[#1E3A5F]"
                  />
                  Only divisions with delayed projects
                </label>
                <label className="grid gap-1 text-[12px] text-[#374151]">
                  Min completion %
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={minCompletionPct}
                    onChange={(e) => setMinCompletionPct(e.target.value)}
                    placeholder="e.g. 50"
                    className="h-8 w-full rounded border border-[#D1D5DB] px-2 text-[12.5px]"
                  />
                </label>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-[#F3F4F6] pt-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setOnlyWithProjects(false);
                    setOnlyWithDelayed(false);
                    setMinCompletionPct('');
                  }}
                  disabled={activeFilterCount === 0}
                  className="text-[11px] font-semibold text-[#B91C1C] hover:underline disabled:cursor-not-allowed disabled:text-[#D1D5DB]"
                >
                  Clear filters
                </button>
                <button
                  type="button"
                  onClick={() => setFilterOpen(false)}
                  className="rounded bg-[#1E3A5F] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#152a48]"
                >
                  Done ✓
                </button>
              </div>
            </div>
          ) : null}
        </div>
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
                // No client-side drill-in modal yet — divisions are new. Deep-link
                // to the project register with a division filter instead.
                window.location.assign(`/projects?divisionId=${row.divisionId}`);
              }}
            />
          ))}
        </div>
      )}
    </article>
  );
}

function Metric({
  label, value, tone, active, onClick,
}: {
  label: string;
  value: number;
  tone: 'brand' | 'success' | 'danger';
  active?: boolean;
  onClick?: () => void;
}): JSX.Element {
  const palette: Record<typeof tone, { border: string; text: string; activeBg: string }> = {
    brand: { border: 'border-t-[#1E3A5F]', text: 'text-[#1E3A5F]', activeBg: 'bg-[#1E3A5F]' },
    success: { border: 'border-t-[#15803D]', text: 'text-[#15803D]', activeBg: 'bg-[#15803D]' },
    danger: { border: 'border-t-[#B91C1C]', text: 'text-[#B91C1C]', activeBg: 'bg-[#B91C1C]' },
  };
  const p = palette[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded border-t-4 border-x border-b px-3 py-2 text-left shadow-sm transition-all',
        active
          ? cn(p.activeBg, p.border, 'border-x-transparent border-b-transparent text-white')
          : cn('border-[#E5E7EB] bg-white hover:-translate-y-0.5 hover:shadow-md', p.border),
      )}
    >
      <div
        className={cn(
          'text-[10.5px] font-bold uppercase tracking-wider',
          active ? 'text-white/80' : 'text-[#6B7280]',
        )}
      >
        {label}
      </div>
      <div className={cn('text-xl font-extrabold tabular-nums', active ? 'text-white' : p.text)}>
        {value}
      </div>
    </button>
  );
}
