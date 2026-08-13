import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useGetMgmtActionSummaryQuery } from '../app/api/kpisApi';
import { useCreateMgmtActionMutation } from '../app/api/mgmtActionsApi';
import { useListProjectsQuery } from '../app/api/projectsApi';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { ColumnFilterText, textMatches, minMatches } from '../components/ui/ColumnFilter';
import { ColumnsButton, ExportButton, useColumnVisibility, type ToolbarColumn } from '../components/ui/TableToolbar';
import { useTableExport, type ExportColumn, type ExportFormat } from '../lib/tableExport';
import { cn } from '../lib/utils';
import type { OpenClosedStatus } from '../types/api';

/** Drives both the existing pill row and the clickable summary blocks —
 *  kept as one source of truth so the two controls stay in sync no matter
 *  which one the user clicks. */
type ViewMode = 'all' | 'open' | 'closed' | 'zero';

/** Which summary block (if any) is the "cause" of the current viewMode —
 *  used purely for the blocks' active-state highlighting. 'totalActions'
 *  is viewMode 'all' + sorted by total, so it needs its own flag. */
type MetricKey = 'projects' | 'totalActions' | 'open' | 'closed';

interface ColFilters {
  project: string;
  minTotal: string;
  minOpen: string;
  minClosed: string;
}
const EMPTY_FILTERS: ColFilters = { project: '', minTotal: '', minOpen: '', minClosed: '' };

// Task 8 — Customizable Fields / Download.
const MGMT_COLUMNS: ToolbarColumn[] = [
  { key: 'sno', label: '#' },
  { key: 'project', label: 'Project' },
  { key: 'total', label: 'Total' },
  { key: 'open', label: 'Open' },
  { key: 'closed', label: 'Closed' },
  { key: 'progress', label: 'Progress' },
];
const MGMT_STORAGE_KEY = 'buidco.mgmtActions.columns.v1';

interface MgmtExportRow {
  sno: number;
  project: string;
  total: number;
  open: number;
  closed: number;
  progressPct: number;
}
const MGMT_EXPORT_COLUMNS: ExportColumn<MgmtExportRow>[] = [
  { key: 'sno', label: '#', align: 'right', exportValue: (r) => r.sno },
  { key: 'project', label: 'Project', exportValue: (r) => r.project },
  { key: 'total', label: 'Total', align: 'right', exportValue: (r) => r.total },
  { key: 'open', label: 'Open', align: 'right', exportValue: (r) => r.open },
  { key: 'closed', label: 'Closed', align: 'right', exportValue: (r) => r.closed },
  { key: 'progress', label: 'Progress', align: 'right', exportValue: (r) => `${r.progressPct}%` },
];

export function MgmtActionsPage(): JSX.Element {
  const { data, isLoading } = useGetMgmtActionSummaryQuery();
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [sortByTotal, setSortByTotal] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  // Task 6 — Table Column Filter (replaces the old popover Filter button):
  // each column narrows independently, combined with the pill/view mode.
  const [colFilters, setColFilters] = useState<ColFilters>(EMPTY_FILTERS);
  const setCol = <K extends keyof ColFilters>(key: K, value: string): void =>
    setColFilters((prev) => ({ ...prev, [key]: value }));
  const activeFilterCount = Object.values(colFilters).filter((v) => v.trim() !== '').length;

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
    let subset = all;
    if (viewMode === 'open') {
      subset = subset.filter((r) => r.openItems > 0).sort((a, b) => b.openItems - a.openItems);
    } else if (viewMode === 'closed') {
      subset = subset.filter((r) => r.closedItems > 0).sort((a, b) => b.closedItems - a.closedItems);
    } else if (viewMode === 'zero') {
      subset = subset.filter((r) => r.totalItems === 0);
    }
    if (sortByTotal) subset = [...subset].sort((a, b) => b.totalItems - a.totalItems);
    subset = subset.filter((r) =>
      textMatches(colFilters.project, r.projectName) &&
      minMatches(colFilters.minTotal, r.totalItems) &&
      minMatches(colFilters.minOpen, r.openItems) &&
      minMatches(colFilters.minClosed, r.closedItems),
    );
    return subset;
  }, [data, viewMode, sortByTotal, colFilters]);

  const totals = useMemo(() => {
    const all = data?.items ?? [];
    return {
      projects: all.length,
      totalActions: all.reduce((s, r) => s + r.totalItems, 0),
      openActions: all.reduce((s, r) => s + r.openItems, 0),
      closedActions: all.reduce((s, r) => s + r.closedItems, 0),
    };
  }, [data]);

  const { visibility, isVisible, toggle, showAll, hideAll } = useColumnVisibility(MGMT_STORAGE_KEY, MGMT_COLUMNS);
  const { exporting, error: exportError, run } = useTableExport<MgmtExportRow>();

  const runExport = (format: ExportFormat): void => {
    const exportRows: MgmtExportRow[] = rows.map((r, i) => ({
      sno: i + 1,
      project: r.projectName ?? r.projectId,
      total: r.totalItems,
      open: r.openItems,
      closed: r.closedItems,
      progressPct: r.totalItems > 0 ? Math.round((r.closedItems / r.totalItems) * 100) : 0,
    }));
    void run(
      format,
      MGMT_EXPORT_COLUMNS.filter((c) => isVisible(c.key)),
      exportRows,
      { title: 'BUIDCO - Management Actions', sheetName: 'Mgmt Actions', fileNamePrefix: 'Management_Actions' },
    );
  };

  return (
    <article className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[#111827]">Management Actions</h1>
          <p className="text-[12.5px] text-[#6B7280]">
            Cross-project view. Add or close individual actions here, or from a project&apos;s Input
            Sheet → Section 07.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>+ Add Action</Button>
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
        {activeFilterCount > 0 ? (
          <button
            type="button"
            onClick={() => setColFilters(EMPTY_FILTERS)}
            className="text-[11px] font-semibold text-[#B91C1C] hover:underline"
          >
            Clear column filters ({activeFilterCount})
          </button>
        ) : null}
        {exportError ? <span className="text-[11px] text-[#B91C1C]">{exportError}</span> : null}
        <div className="ml-auto flex items-center gap-2">
          <ColumnsButton
            columns={MGMT_COLUMNS}
            visibility={visibility}
            onToggle={toggle}
            onShowAll={showAll}
            onHideAll={hideAll}
          />
          <ExportButton onExport={runExport} exporting={exporting} />
        </div>
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
                    {isVisible('sno') ? <th className="px-4 py-2 text-left align-top">#</th> : null}
                    {isVisible('project') ? (
                      <th className="px-4 py-2 text-left align-top">
                        <div>Project</div>
                        <ColumnFilterText value={colFilters.project} onChange={(v) => setCol('project', v)} />
                      </th>
                    ) : null}
                    {isVisible('total') ? (
                      <th className="px-4 py-2 text-right align-top">
                        <div>Total</div>
                        <ColumnFilterText value={colFilters.minTotal} onChange={(v) => setCol('minTotal', v)} placeholder="≥" align="right" />
                      </th>
                    ) : null}
                    {isVisible('open') ? (
                      <th className="px-4 py-2 text-right align-top">
                        <div>Open</div>
                        <ColumnFilterText value={colFilters.minOpen} onChange={(v) => setCol('minOpen', v)} placeholder="≥" align="right" />
                      </th>
                    ) : null}
                    {isVisible('closed') ? (
                      <th className="px-4 py-2 text-right align-top">
                        <div>Closed</div>
                        <ColumnFilterText value={colFilters.minClosed} onChange={(v) => setCol('minClosed', v)} placeholder="≥" align="right" />
                      </th>
                    ) : null}
                    {isVisible('progress') ? <th className="px-4 py-2 text-right align-top">Progress</th> : null}
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
                        {isVisible('sno') ? <td className="px-4 py-2 text-[#9CA3AF]">{idx + 1}</td> : null}
                        {isVisible('project') ? (
                          <td className="px-4 py-2">
                            <NavLink
                              to={`/projects/${r.projectId}`}
                              className="font-semibold text-[#1D4ED8] hover:underline"
                            >
                              {r.projectName ?? r.projectId}
                            </NavLink>
                          </td>
                        ) : null}
                        {isVisible('total') ? (
                          <td className="px-4 py-2 text-right tabular-nums text-[#374151]">
                            {r.totalItems}
                          </td>
                        ) : null}
                        {isVisible('open') ? (
                          <td
                            className={cn(
                              'px-4 py-2 text-right tabular-nums font-semibold',
                              r.openItems > 0 ? 'text-[#B91C1C]' : 'text-[#6B7280]',
                            )}
                          >
                            {r.openItems}
                          </td>
                        ) : null}
                        {isVisible('closed') ? (
                          <td
                            className={cn(
                              'px-4 py-2 text-right tabular-nums font-semibold',
                              r.closedItems > 0 ? 'text-[#15803D]' : 'text-[#6B7280]',
                            )}
                          >
                            {r.closedItems}
                          </td>
                        ) : null}
                        {isVisible('progress') ? (
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
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {addOpen ? <AddMgmtActionDialog onClose={() => setAddOpen(false)} /> : null}
    </article>
  );
}

/**
 * Task 6 — Add Action dialog. Management actions are always scoped to a
 * project (the API is POST /projects/:id/management-actions), so creating
 * one from this cross-project page means picking which project it belongs
 * to first.
 */
function AddMgmtActionDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const projectsQuery = useListProjectsQuery({ limit: 100 });
  const [createAction, createState] = useCreateMgmtActionMutation();

  const [projectId, setProjectId] = useState('');
  const [topic, setTopic] = useState('');
  const [status, setStatus] = useState<OpenClosedStatus>('Open');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const projects = [...(projectsQuery.data?.items ?? [])].sort((a, b) =>
    a.projectName.localeCompare(b.projectName),
  );
  const canSubmit = projectId !== '' && topic.trim() !== '';

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) return;
    setError(null);
    try {
      await createAction({
        projectId,
        body: {
          topic: topic.trim(),
          status,
          deadlineDate: deadlineDate || null,
        },
      }).unwrap();
      onClose();
    } catch (err) {
      setError(readError(err));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-action-title"
    >
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={createState.isLoading ? undefined : onClose}
      />
      <div className="relative w-full max-w-md rounded-xl border border-[#E5E7EB] bg-white shadow-2xl">
        <header className="border-b border-[#F3F4F6] px-5 py-3.5">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">
            Management Actions
          </p>
          <h3 id="add-action-title" className="mt-0.5 text-[14.5px] font-bold text-[#111827]">
            Add Action
          </h3>
        </header>

        <div className="space-y-3 px-5 py-4">
          <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
              Project <span className="text-[#B91C1C]">*</span>
            </span>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={createState.isLoading || projectsQuery.isLoading}
              className="h-9 w-full rounded border border-[#D1D5DB] bg-white px-2.5 text-[13px] text-[#111827] disabled:cursor-not-allowed disabled:bg-[#F9FAFB]"
            >
              <option value="">— Select a project —</option>
              {projects.map((p) => (
                <option key={p.projectId} value={p.projectId}>{p.projectName}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
              Topic / Action required <span className="text-[#B91C1C]">*</span>
            </span>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
              placeholder="Describe the action or decision required…"
              disabled={createState.isLoading}
              className="w-full resize-y rounded border border-[#D1D5DB] bg-white px-2.5 py-2 text-[13px] text-[#111827] disabled:cursor-not-allowed disabled:bg-[#F9FAFB]"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                Status
              </span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as OpenClosedStatus)}
                disabled={createState.isLoading}
                className="h-9 w-full rounded border border-[#D1D5DB] bg-white px-2.5 text-[13px] text-[#111827] disabled:cursor-not-allowed disabled:bg-[#F9FAFB]"
              >
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                Deadline
              </span>
              <input
                type="date"
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
                disabled={createState.isLoading}
                className="h-9 w-full rounded border border-[#D1D5DB] bg-white px-2.5 text-[13px] text-[#111827] disabled:cursor-not-allowed disabled:bg-[#F9FAFB]"
              />
            </label>
          </div>

          {error ? <p className="text-[12px] text-[#B91C1C]">{error}</p> : null}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[#F3F4F6] px-5 py-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={createState.isLoading}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void handleSubmit()} disabled={!canSubmit || createState.isLoading}>
            {createState.isLoading ? 'Saving…' : 'Add Action'}
          </Button>
        </footer>
      </div>
    </div>
  );
}

function readError(err: unknown): string {
  if (err && typeof err === 'object' && 'data' in err) {
    const data = (err as { data?: unknown }).data;
    if (data && typeof data === 'object' && 'error' in data) {
      const e = (data as { error?: { message?: string } }).error;
      if (e?.message) return e.message;
    }
  }
  return 'Could not add the action. Please retry.';
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
