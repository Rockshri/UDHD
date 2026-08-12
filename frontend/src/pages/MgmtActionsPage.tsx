import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useGetMgmtActionSummaryQuery } from '../app/api/kpisApi';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../lib/utils';

/** Drives both the existing pill row and the (new, Task 5) clickable
 *  summary blocks — kept as one source of truth so the two controls stay
 *  in sync no matter which one the user clicks. */
type ViewMode = 'all' | 'open' | 'closed' | 'zero';

/** Which summary block (if any) is the "cause" of the current viewMode —
 *  used purely for the blocks' active-state highlighting. 'totalActions'
 *  is viewMode 'all' + sorted by total, so it needs its own flag. */
type MetricKey = 'projects' | 'totalActions' | 'open' | 'closed';

export function MgmtActionsPage(): JSX.Element {
  const { data, isLoading } = useGetMgmtActionSummaryQuery();
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [sortByTotal, setSortByTotal] = useState(false);
  const [search, setSearch] = useState('');

  // Task 5 — Filter panel. Uses the fields already present on the summary
  // row (total/open/closed counts) rather than reaching into a separately
  // paginated project list just to filter, so this works correctly however
  // many projects exist.
  const [filterOpen, setFilterOpen] = useState(false);
  const [minTotal, setMinTotal] = useState('');
  const [minOpen, setMinOpen] = useState('');
  const [minClosed, setMinClosed] = useState('');
  const activeFilterCount =
    (minTotal.trim() ? 1 : 0) + (minOpen.trim() ? 1 : 0) + (minClosed.trim() ? 1 : 0);

  const activeMetric: MetricKey | null =
    viewMode === 'all' && sortByTotal ? 'totalActions'
      : viewMode === 'all' ? 'projects'
        : viewMode === 'open' ? 'open'
          : viewMode === 'closed' ? 'closed'
            : null;

  const setMetric = (key: MetricKey): void => {
    if (activeMetric === key) {
      // Click again to clear back to the unfiltered default.
      setViewMode('all');
      setSortByTotal(false);
      return;
    }
    setSortByTotal(key === 'totalActions');
    setViewMode(key === 'open' ? 'open' : key === 'closed' ? 'closed' : 'all');
  };

  const rows = useMemo(() => {
    const all = data?.items ?? [];
    const term = search.trim().toLowerCase();
    const minTotalN = minTotal.trim() ? Number(minTotal) : null;
    const minOpenN = minOpen.trim() ? Number(minOpen) : null;
    const minClosedN = minClosed.trim() ? Number(minClosed) : null;

    let subset = all;
    if (viewMode === 'open') {
      subset = subset.filter((r) => r.openItems > 0).sort((a, b) => b.openItems - a.openItems);
    } else if (viewMode === 'closed') {
      subset = subset.filter((r) => r.closedItems > 0).sort((a, b) => b.closedItems - a.closedItems);
    } else if (viewMode === 'zero') {
      subset = subset.filter((r) => r.totalItems === 0);
    }
    if (sortByTotal) subset = [...subset].sort((a, b) => b.totalItems - a.totalItems);
    if (minTotalN !== null && Number.isFinite(minTotalN)) {
      subset = subset.filter((r) => r.totalItems >= minTotalN);
    }
    if (minOpenN !== null && Number.isFinite(minOpenN)) {
      subset = subset.filter((r) => r.openItems >= minOpenN);
    }
    if (minClosedN !== null && Number.isFinite(minClosedN)) {
      subset = subset.filter((r) => r.closedItems >= minClosedN);
    }
    if (term) {
      subset = subset.filter((r) => (r.projectName ?? '').toLowerCase().includes(term));
    }
    return subset;
  }, [data, viewMode, sortByTotal, search, minTotal, minOpen, minClosed]);

  const totals = useMemo(() => {
    const all = data?.items ?? [];
    return {
      projects: all.length,
      totalActions: all.reduce((s, r) => s + r.totalItems, 0),
      openActions: all.reduce((s, r) => s + r.openItems, 0),
      closedActions: all.reduce((s, r) => s + r.closedItems, 0),
    };
  }, [data]);

  return (
    <article className="space-y-4">
      <header>
        <h1 className="text-lg font-bold text-[#111827]">Management Actions</h1>
        <p className="text-[12.5px] text-[#6B7280]">
          Cross-project view. Add or close individual actions on each project's Input Sheet →
          Section 07.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Metric
          label="Projects"
          value={totals.projects}
          tone="brand"
          active={activeMetric === 'projects'}
          onClick={() => setMetric('projects')}
        />
        <Metric
          label="Total Actions"
          value={totals.totalActions}
          tone="info"
          active={activeMetric === 'totalActions'}
          onClick={() => setMetric('totalActions')}
        />
        <Metric
          label="Open"
          value={totals.openActions}
          tone="danger"
          active={activeMetric === 'open'}
          onClick={() => setMetric('open')}
        />
        <Metric
          label="Closed"
          value={totals.closedActions}
          tone="success"
          active={activeMetric === 'closed'}
          onClick={() => setMetric('closed')}
        />
      </div>
      {activeMetric ? (
        <p className="text-[11.5px] text-[#6B7280]">
          Showing {rows.length} project{rows.length === 1 ? '' : 's'} for{' '}
          <span className="font-semibold text-[#374151]">
            {activeMetric === 'projects' && 'All projects'}
            {activeMetric === 'totalActions' && 'All projects, sorted by total actions'}
            {activeMetric === 'open' && 'Projects with open actions'}
            {activeMetric === 'closed' && 'Projects with closed actions'}
          </span>{' '}
          — click the block again to clear.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: 'all', label: `All projects (${data?.items.length ?? 0})` },
            { id: 'open', label: `With open actions (${totals.openActions > 0 ? data?.items.filter((r) => r.openItems > 0).length : 0})` },
            { id: 'zero', label: `Without any actions (${data?.items.filter((r) => r.totalItems === 0).length ?? 0})` },
          ] satisfies Array<{ id: ViewMode; label: string }>
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setViewMode(t.id); setSortByTotal(false); }}
            className={cn(
              'rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors',
              viewMode === t.id && !sortByTotal
                ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white'
                : 'border-[#D1D5DB] bg-white text-[#6B7280] hover:text-[#374151]',
            )}
          >
            {t.label}
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
            <div className="absolute left-0 top-full z-20 mt-1.5 w-64 rounded-lg border border-[#E5E7EB] bg-white p-3 shadow-lg">
              <div className="space-y-2.5">
                <label className="grid gap-1 text-[12px] text-[#374151]">
                  Min total actions
                  <input
                    type="number"
                    min={0}
                    value={minTotal}
                    onChange={(e) => setMinTotal(e.target.value)}
                    placeholder="e.g. 1"
                    className="h-8 w-full rounded border border-[#D1D5DB] px-2 text-[12.5px]"
                  />
                </label>
                <label className="grid gap-1 text-[12px] text-[#374151]">
                  Min open actions
                  <input
                    type="number"
                    min={0}
                    value={minOpen}
                    onChange={(e) => setMinOpen(e.target.value)}
                    placeholder="e.g. 1"
                    className="h-8 w-full rounded border border-[#D1D5DB] px-2 text-[12.5px]"
                  />
                </label>
                <label className="grid gap-1 text-[12px] text-[#374151]">
                  Min closed actions
                  <input
                    type="number"
                    min={0}
                    value={minClosed}
                    onChange={(e) => setMinClosed(e.target.value)}
                    placeholder="e.g. 1"
                    className="h-8 w-full rounded border border-[#D1D5DB] px-2 text-[12.5px]"
                  />
                </label>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-[#F3F4F6] pt-2.5">
                <button
                  type="button"
                  onClick={() => { setMinTotal(''); setMinOpen(''); setMinClosed(''); }}
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
          placeholder="Search project…"
          className="ml-auto h-8 w-64 rounded border border-[#D1D5DB] px-3 text-[12.5px]"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4">
              <Skeleton className="h-40 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-center text-[12.5px] text-[#6B7280]">
              No projects match the current filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-[12.5px]">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">
                    <th className="px-4 py-2 text-left">#</th>
                    <th className="px-4 py-2 text-left">Project</th>
                    <th className="px-4 py-2 text-right">Total</th>
                    <th className="px-4 py-2 text-right">Open</th>
                    <th className="px-4 py-2 text-right">Closed</th>
                    <th className="px-4 py-2 text-right">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const pct = r.totalItems > 0 ? Math.round((r.closedItems / r.totalItems) * 100) : 0;
                    return (
                      <tr
                        key={r.projectId}
                        className={cn(
                          'border-b border-[#F3F4F6] hover:bg-[#F9FAFB]',
                          idx % 2 === 1 && 'bg-[#FAFAFA]',
                        )}
                      >
                        <td className="px-4 py-2 text-[#9CA3AF]">{idx + 1}</td>
                        <td className="px-4 py-2">
                          <NavLink
                            to={`/projects/${r.projectId}`}
                            className="font-semibold text-[#1D4ED8] hover:underline"
                          >
                            {r.projectName ?? r.projectId}
                          </NavLink>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-[#374151]">
                          {r.totalItems}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-2 text-right tabular-nums font-semibold',
                            r.openItems > 0 ? 'text-[#B91C1C]' : 'text-[#6B7280]',
                          )}
                        >
                          {r.openItems}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-2 text-right tabular-nums font-semibold',
                            r.closedItems > 0 ? 'text-[#15803D]' : 'text-[#6B7280]',
                          )}
                        >
                          {r.closedItems}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="ml-auto flex items-center justify-end gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#F3F4F6]">
                              <div
                                className="h-full bg-[#15803D]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-10 text-right tabular-nums text-[11px] text-[#374151]">
                              {pct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </article>
  );
}

function Metric({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone: 'brand' | 'info' | 'danger' | 'success';
  active?: boolean;
  onClick?: () => void;
}): JSX.Element {
  const palette: Record<typeof tone, { border: string; text: string; activeBg: string }> = {
    brand: { border: 'border-t-[#1E3A5F]', text: 'text-[#1E3A5F]', activeBg: 'bg-[#1E3A5F]' },
    info: { border: 'border-t-[#1D4ED8]', text: 'text-[#1D4ED8]', activeBg: 'bg-[#1D4ED8]' },
    danger: { border: 'border-t-[#B91C1C]', text: 'text-[#B91C1C]', activeBg: 'bg-[#B91C1C]' },
    success: { border: 'border-t-[#15803D]', text: 'text-[#15803D]', activeBg: 'bg-[#15803D]' },
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
