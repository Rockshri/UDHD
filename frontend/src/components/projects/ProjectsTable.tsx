import { useMemo, useState } from 'react';
import type { ProjectListItem } from '../../types/api';
import type { Lookups } from '../../types/api';
import { displayNitDate, displayNitNumber } from '../../features/tender/tenderWorkflow';
import { formatCurrencyCr, formatDate } from '../../lib/formatters';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { ColumnFilterButton } from '../table/ColumnFilterButton';
import { useColumnFilters, type ColumnAccessor } from '../table/useColumnFilters';
import { OmAlertCell } from './OmAlertCell';
import { PbgAlertCell } from './PbgAlertCell';
import { PriorityBadge } from './PriorityBadge';
import { ProgressBar } from './ProgressBar';
import { ProjectProfileModal } from './ProjectProfileModal';
import { StatusBadge } from './StatusBadge';

/** Columns match the reference JSX register (with schema-backed field names). */
export interface Column {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  minWidth?: number;
  defaultVisible?: boolean;
  render: (row: ProjectListItem, index: number, ctx: LookupCtx) => React.ReactNode;
  sortValue?: (row: ProjectListItem) => string | number | null;
  /** Bucket the row's value for column-level filtering. Return a scalar
   *  for single-value columns or an array for multi-value ones (e.g.
   *  Schemes). Undefined = no filter icon (progress bars, action buttons). */
  filterValue?: (row: ProjectListItem, ctx: LookupCtx) =>
    | string | number | null | undefined
    | readonly (string | number | null | undefined)[];
}

interface LookupCtx {
  sectorById: Map<number, string>;
  districtById: Map<number, string>;
  schemeById: Map<number, string>;
  divisionById: Map<number, { name: string; regionName: string }>;
}

const COLUMNS: Column[] = [
  {
    key: 'sno',
    label: 'S.No.',
    align: 'center',
    minWidth: 50,
    defaultVisible: true,
    render: (_r, i) => <span className="text-[#9CA3AF] tabular-nums">{i + 1}</span>,
  },
  {
    key: 'projectName',
    label: 'Project Name',
    minWidth: 220,
    defaultVisible: true,
    render: (r) => (
      <span className="font-semibold text-[#1D4ED8]">{r.projectName || '—'}</span>
    ),
    sortValue: (r) => r.projectName,
  },
  {
    key: 'city',
    label: 'City',
    minWidth: 100,
    defaultVisible: true,
    render: (r) => r.city ?? '—',
    sortValue: (r) => r.city,
    filterValue: (r) => r.city,
  },
  // District column removed per request — Division is the primary
  // geographic dimension in the register now.
  {
    key: 'division',
    label: 'Division',
    minWidth: 130,
    defaultVisible: true,
    render: (r, _i, ctx) =>
      r.divisionId ? (ctx.divisionById.get(r.divisionId)?.name ?? '—') : '—',
    sortValue: (r) => r.divisionId,
    filterValue: (r, ctx) => (r.divisionId ? ctx.divisionById.get(r.divisionId)?.name : null),
  },
  {
    key: 'region',
    label: 'Region',
    minWidth: 110,
    defaultVisible: false,
    render: (r, _i, ctx) =>
      r.divisionId ? (ctx.divisionById.get(r.divisionId)?.regionName ?? '—') : '—',
    // Sort proxies on divisionId (South Bihar IDs precede North Bihar per the
    // migration insert order) so we don't need lookup ctx in sortValue.
    sortValue: (r) => r.divisionId,
    filterValue: (r, ctx) => (r.divisionId ? ctx.divisionById.get(r.divisionId)?.regionName : null),
  },
  {
    key: 'contractor',
    label: 'Contractor',
    minWidth: 160,
    defaultVisible: true,
    render: (r) => (r.contractor ? <span className="truncate">{r.contractor}</span> : '—'),
    sortValue: (r) => r.contractor,
    filterValue: (r) => r.contractor,
  },
  {
    key: 'pd',
    label: 'PD',
    minWidth: 90,
    defaultVisible: false,
    render: (r) => r.pd ?? '—',
    sortValue: (r) => r.pd,
    filterValue: (r) => r.pd,
  },
  {
    key: 'sectorName',
    label: 'Sector',
    minWidth: 110,
    defaultVisible: true,
    render: (r, _i, ctx) => (r.sectorId ? (ctx.sectorById.get(r.sectorId) ?? '—') : '—'),
    sortValue: (r) => r.sectorId,
    filterValue: (r, ctx) => (r.sectorId ? ctx.sectorById.get(r.sectorId) : null),
  },
  {
    key: 'schemes',
    label: 'Scheme(s)',
    minWidth: 180,
    defaultVisible: true,
    render: (r, _i, ctx) => {
      if (!r.schemes || r.schemes.length === 0) return <span className="text-[#D1D5DB]">—</span>;
      const names = r.schemes.map((id) => ctx.schemeById.get(id) ?? `#${id}`);
      return (
        <div className="flex flex-wrap gap-1">
          {names.map((n) => (
            <span
              key={n}
              className="inline-flex rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10.5px] font-semibold text-[#1D4ED8]"
            >
              {n}
            </span>
          ))}
        </div>
      );
    },
    sortValue: (r) => (r.schemes && r.schemes.length > 0 ? r.schemes[0] ?? null : null),
    // Multi-value: a row matches if ANY of its schemes is in the selected
    // set. Returning an array is the shape useColumnFilters supports.
    filterValue: (r, ctx) => {
      if (!r.schemes || r.schemes.length === 0) return null;
      return r.schemes.map((id) => ctx.schemeById.get(id) ?? `#${id}`);
    },
  },
  // Note: 'division' + 'region' columns are inserted alongside 'district' above.
  {
    key: 'projectStageV2',
    label: 'Stage',
    minWidth: 130,
    defaultVisible: false,
    render: (r) => r.projectStageV2 ?? '—',
    sortValue: (r) => r.projectStageV2,
    filterValue: (r) => r.projectStageV2,
  },
  {
    key: 'contractType',
    label: 'Contract Type',
    minWidth: 140,
    defaultVisible: false,
    render: (r) => r.contractType ?? '—',
    sortValue: (r) => r.contractType,
    filterValue: (r) => r.contractType,
  },
  {
    key: 'aaAmountCr',
    label: 'AA (₹ Cr.)',
    minWidth: 110,
    align: 'right',
    defaultVisible: true,
    render: (r) => <span className="tabular-nums">{formatCurrencyCr(r.aaAmountCr)}</span>,
    sortValue: (r) => r.aaAmountCr,
  },
  {
    key: 'revisedAaAmountCr',
    label: 'Revised AA (₹ Cr.)',
    minWidth: 130,
    align: 'right',
    defaultVisible: false,
    render: (r) => <span className="tabular-nums">{formatCurrencyCr(r.revisedAaAmountCr)}</span>,
    sortValue: (r) => r.revisedAaAmountCr,
  },
  {
    key: 'agreementAmountCr',
    label: 'Agreement (₹ Cr.)',
    minWidth: 130,
    align: 'right',
    defaultVisible: true,
    render: (r) => <span className="tabular-nums">{formatCurrencyCr(r.agreementAmountCr)}</span>,
    sortValue: (r) => r.agreementAmountCr,
  },
  {
    key: 'physicalProgressPct',
    label: 'Physical %',
    minWidth: 130,
    defaultVisible: true,
    render: (r) => (
      <ProgressBar value={r.effectivePhysicalPct ?? r.physicalProgressPct} color="#1D4ED8" />
    ),
    sortValue: (r) => r.effectivePhysicalPct ?? r.physicalProgressPct,
  },
  {
    key: 'financialProgressCr',
    label: 'Financial (₹ Cr.)',
    minWidth: 130,
    align: 'right',
    defaultVisible: false,
    render: (r) => <span className="tabular-nums">{formatCurrencyCr(r.financialProgressCr)}</span>,
    sortValue: (r) => r.financialProgressCr,
  },
  {
    key: 'financialProgressPct',
    label: 'Financial %',
    minWidth: 130,
    defaultVisible: true,
    render: (r) => <ProgressBar value={r.financialProgressPct} color="#22C55E" />,
    sortValue: (r) => r.financialProgressPct,
  },
  {
    key: 'expectedCompletion',
    label: 'Expected Completion',
    minWidth: 150,
    defaultVisible: true,
    render: (r) =>
      r.expectedCompletionDate ? formatDate(r.expectedCompletionDate) : (r.expectedCompletionRaw ?? '—'),
    sortValue: (r) => r.expectedCompletionDate,
  },
  {
    key: 'status',
    label: 'Execution Status',
    minWidth: 140,
    defaultVisible: true,
    render: (r) => <StatusBadge status={r.status} />,
    sortValue: (r) => r.status,
    filterValue: (r) => r.status,
  },
  {
    key: 'remark',
    label: 'Outstanding Gap',
    minWidth: 220,
    defaultVisible: true,
    render: (r) =>
      r.remark ? (
        <span className="inline-block max-w-[260px] rounded bg-[#FEF2F2] px-2 py-0.5 text-[11px] leading-snug text-[#B91C1C]">
          ⚠ {r.remark}
        </span>
      ) : (
        <span className="text-[#D1D5DB]">—</span>
      ),
    sortValue: (r) => r.remark,
    // Bucket to Yes/No so the column dropdown is useful instead of listing
    // every free-text remark as its own filter value.
    filterValue: (r) => (r.remark && r.remark.trim() !== '' ? 'Yes' : 'No'),
  },
  {
    key: 'priority',
    label: 'Priority',
    minWidth: 100,
    align: 'center',
    defaultVisible: true,
    render: (r) => <PriorityBadge priority={r.priority} />,
    sortValue: (r) => r.priority,
    filterValue: (r) => r.priority,
  },
  {
    key: 'pbgAlert',
    label: 'PBG Alert',
    minWidth: 150,
    align: 'center',
    defaultVisible: true,
    render: (r) => <PbgAlertCell pbgExpiryDate={r.pbgExpiryDate} />,
    sortValue: (r) => r.pbgExpiryDate,
  },
  {
    key: 'omAlert',
    label: 'O&M Status',
    minWidth: 150,
    align: 'center',
    defaultVisible: true,
    render: (r) => (
      <OmAlertCell
        status={r.status}
        omApplicable={r.omApplicable}
        omStartDate={r.omStartDate}
        omEndDate={r.omEndDate}
        omPeriodMonths={r.omPeriodMonths}
        omStatusOverride={r.omStatusOverride}
      />
    ),
  },
  {
    key: 'geoTagging',
    label: 'GeoTag',
    minWidth: 80,
    align: 'center',
    defaultVisible: false,
    render: (r) =>
      r.geoTaggingUrl ? (
        <a
          href={r.geoTaggingUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-[11px] font-semibold text-[#1D4ED8] hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          📍 View
        </a>
      ) : (
        <span className="text-[#D1D5DB]">—</span>
      ),
  },
  {
    // NIT_addition_instructions.md §5/§6 — always show the value or the
    // "Yet to be Published" placeholder so Project Directors can spot rows
    // that still need NIT publication at a glance. Off by default (per the
    // user preference); toggle from the ⚙ Columns picker.
    key: 'nitNumber',
    label: 'NIT Number',
    minWidth: 160,
    defaultVisible: false,
    render: (r) => {
      const val = r.nitNumber;
      return val && val.trim() !== '' ? (
        <span className="text-[#111827]">{val}</span>
      ) : (
        <span className="italic text-[#B45309]">{displayNitNumber(null)}</span>
      );
    },
    sortValue: (r) => r.nitNumber,
  },
  {
    key: 'nitDate',
    label: 'NIT Date',
    minWidth: 130,
    defaultVisible: false,
    render: (r) =>
      r.nitDate ? (
        <span className="tabular-nums text-[#111827]">{formatDate(r.nitDate)}</span>
      ) : (
        <span className="italic text-[#B45309]">{displayNitDate(null)}</span>
      ),
    sortValue: (r) => r.nitDate,
  },
];

export const ALL_COLUMN_KEYS = COLUMNS.map((c) => c.key);

const LS_KEY = 'buidco.projects.columnVisibility.v1';

function loadVisibility(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    /* localStorage unavailable */
  }
  const defaults: Record<string, boolean> = {};
  for (const c of COLUMNS) defaults[c.key] = c.defaultVisible !== false;
  return defaults;
}

function saveVisibility(v: Record<string, boolean>): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(v));
  } catch {
    /* localStorage unavailable */
  }
}

interface ProjectsTableProps {
  rows: ProjectListItem[];
  lookups: Lookups | undefined;
  isFetching?: boolean;
  /** Multi-select for export flow (Exporting.md §5). Optional — undefined
   *  disables the checkbox column entirely, preserving legacy callers. */
  selectedIds?: Set<string>;
  onToggleOne?: (projectId: string, next: boolean) => void;
  onToggleAllOnPage?: (rowIds: string[], next: boolean) => void;
}

export function ProjectsTable({
  rows, lookups, isFetching,
  selectedIds, onToggleOne, onToggleAllOnPage,
}: ProjectsTableProps): JSX.Element {
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => loadVisibility());
  const [showPicker, setShowPicker] = useState(false);
  const [sortKey, setSortKey] = useState<string>('sno');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [profileProjectId, setProfileProjectId] = useState<string | null>(null);

  const ctx = useMemo<LookupCtx>(() => {
    const regionById = new Map(
      (lookups?.regions ?? []).map((r) => [r.regionId, r.regionName]),
    );
    return {
      sectorById: new Map((lookups?.sectors ?? []).map((s) => [s.sectorId, s.sectorName])),
      districtById: new Map((lookups?.districts ?? []).map((d) => [d.districtId, d.districtName])),
      schemeById: new Map((lookups?.schemes ?? []).map((s) => [s.schemeId, s.schemeName])),
      divisionById: new Map(
        (lookups?.divisions ?? []).map((d) => [
          d.divisionId,
          { name: d.divisionName, regionName: regionById.get(d.regionId) ?? '' },
        ]),
      ),
    };
  }, [lookups]);

  const visibleColumns = COLUMNS.filter((c) => visibility[c.key] !== false);

  // Excel-style per-column filters (session-only). Applies client-side to
  // the currently-loaded page — for the Projects Register that's whatever
  // the top ProjectsFilterBar has narrowed down to. Both filter layers
  // combine (AND) per the spec.
  const columnAccessors = useMemo(() => {
    const out: Record<string, ColumnAccessor<ProjectListItem>> = {};
    for (const c of visibleColumns) {
      if (!c.filterValue) continue;
      out[c.key] = (row) => {
        const v = c.filterValue!(row, ctx);
        return v ?? null;
      };
    }
    return out;
  }, [visibleColumns, ctx]);
  const colFilters = useColumnFilters<ProjectListItem>({ rows, columns: columnAccessors });

  // Multi-select is "on" only when a selectedIds Set was passed. That way
  // legacy callers with no selection props render the table as before.
  const selectMode = selectedIds !== undefined;
  const pageRowIds = rows.map((r) => r.projectId);
  const pageAllSelected = selectMode && pageRowIds.length > 0
    ? pageRowIds.every((id) => selectedIds!.has(id))
    : false;
  const pageSomeSelected = selectMode
    ? pageRowIds.some((id) => selectedIds!.has(id))
    : false;
  const toggle = (key: string): void => {
    setVisibility((prev) => {
      const next = { ...prev, [key]: !(prev[key] !== false) };
      saveVisibility(next);
      return next;
    });
  };
  const setAllVisibility = (val: boolean): void => {
    const next: Record<string, boolean> = {};
    for (const c of COLUMNS) next[c.key] = val;
    setVisibility(next);
    saveVisibility(next);
  };

  const sortedRows = useMemo(() => {
    const source = colFilters.filteredRows;
    if (sortKey === 'sno') return source;
    const col = COLUMNS.find((c) => c.key === sortKey);
    if (!col?.sortValue) return source;
    const arr = [...source];
    arr.sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [colFilters.filteredRows, sortKey, sortDir]);

  const onSort = (key: string): void => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };
  const arrow = (key: string): string => (sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '');

  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#F3F4F6] px-3 py-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[#6B7280]">
          {colFilters.activeCount > 0
            ? `${sortedRows.length} of ${rows.length} on this page match ${colFilters.activeCount} column filter${colFilters.activeCount === 1 ? '' : 's'}`
            : `${rows.length} project${rows.length === 1 ? '' : 's'} on this page`}
          {isFetching ? ' · refreshing…' : ''}
        </span>
        <div className="flex items-center gap-2">
          {colFilters.activeCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={colFilters.clearAll}>
              ✕ Clear column filters
            </Button>
          ) : null}
          <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPicker((p) => !p)}
            aria-expanded={showPicker}
          >
            ⚙ Columns ({visibleColumns.length}/{COLUMNS.length})
          </Button>
          {showPicker ? (
            <div className="absolute right-0 top-full z-30 mt-1 w-64 rounded-lg border border-[#E5E7EB] bg-white p-3 shadow-lg">
              <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-[#374151]">
                Column visibility
                <div className="flex gap-1">
                  <Button variant="ghost" size="xs" onClick={() => setAllVisibility(true)}>
                    Show all
                  </Button>
                  <Button variant="ghost" size="xs" onClick={() => setAllVisibility(false)}>
                    Hide all
                  </Button>
                </div>
              </div>
              <div className="max-h-60 space-y-1 overflow-y-auto">
                {COLUMNS.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 text-xs text-[#374151]">
                    <input
                      type="checkbox"
                      checked={visibility[c.key] !== false}
                      onChange={() => toggle(c.key)}
                      className="h-3.5 w-3.5"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        {/* min-w-[960px]: on phones/tablets the many-column table would squish
            below readability. Force a min width so the wrapper scrolls
            horizontally instead. */}
        <table className="w-full min-w-[960px] border-collapse text-xs">
          <thead className="bg-[#F9FAFB]">
            <tr>
              {selectMode ? (
                <th
                  scope="col"
                  className="sticky top-0 z-10 w-[38px] border-b border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-center"
                >
                  <input
                    type="checkbox"
                    aria-label="Select all rows on this page"
                    checked={pageAllSelected}
                    ref={(el) => { if (el) el.indeterminate = pageSomeSelected && !pageAllSelected; }}
                    onChange={(e) => onToggleAllOnPage?.(pageRowIds, e.target.checked)}
                    className="h-3.5 w-3.5 cursor-pointer accent-[#1E3A5F]"
                  />
                </th>
              ) : null}
              {visibleColumns.map((c, idx) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    'sticky top-0 z-10 whitespace-nowrap border-b border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-[#374151]',
                    c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                  )}
                  style={c.minWidth ? { minWidth: c.minWidth } : undefined}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => onSort(c.key)}
                      className="cursor-pointer hover:text-[#1E3A5F]"
                    >
                      {c.label}
                      <span aria-hidden>{arrow(c.key)}</span>
                    </button>
                  ) : (
                    c.label
                  )}
                  {c.filterValue ? (
                    <ColumnFilterButton
                      label={c.label}
                      options={colFilters.optionsFor(c.key)}
                      selected={colFilters.selected(c.key)}
                      onChange={(next) => colFilters.setSelected(c.key, next)}
                      // Rightmost couple of columns anchor their popover to the
                      // right so it doesn't get clipped off the table edge.
                      align={idx >= visibleColumns.length - 3 ? 'end' : 'start'}
                    />
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + (selectMode ? 1 : 0)} className="px-3 py-10 text-center text-[#6B7280]">
                  No projects match your filters.
                </td>
              </tr>
            ) : (
              sortedRows.map((row, i) => {
                const isSelected = selectMode ? selectedIds!.has(row.projectId) : false;
                return (
                  <tr
                    key={row.projectId}
                    role="button"
                    tabIndex={0}
                    onClick={() => setProfileProjectId(row.projectId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setProfileProjectId(row.projectId);
                      }
                    }}
                    className={cn(
                      'cursor-pointer border-b border-[#F3F4F6] hover:bg-[#F0F7FF] focus:bg-[#EFF6FF] focus:outline-none',
                      isSelected && 'bg-[#EFF6FF]',
                    )}
                  >
                    {selectMode ? (
                      <td
                        className="w-[38px] px-3 py-2 text-center align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.projectName}`}
                          checked={isSelected}
                          onChange={(e) => onToggleOne?.(row.projectId, e.target.checked)}
                          className="h-3.5 w-3.5 cursor-pointer accent-[#1E3A5F]"
                        />
                      </td>
                    ) : null}
                    {visibleColumns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          'whitespace-nowrap px-3 py-2 align-middle text-[12px] text-[#374151]',
                          c.align === 'right'
                            ? 'text-right'
                            : c.align === 'center'
                              ? 'text-center'
                              : 'text-left',
                        )}
                      >
                        {c.render(row, i, ctx)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ProjectProfileModal
        projectId={profileProjectId}
        onClose={() => setProfileProjectId(null)}
      />
    </div>
  );
}
