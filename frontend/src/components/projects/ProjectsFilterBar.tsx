import { useGetLookupsQuery } from '../../app/api/lookupsApi';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';
import type { ProjectFilters } from '../../hooks/useProjectFilters';

interface Props {
  filters: ProjectFilters;
  setFilter: <K extends keyof ProjectFilters>(key: K, value: string) => void;
  clearAll: () => void;
  activeCount: number;
  totalRows: number | undefined;
}

const STATUSES = ['Not Started', 'In Progress', 'Completed', 'On Hold', 'Delayed'];
// New Project Stage options (Phase A §3.2).
const STAGES = ['Conceptualisation', 'Design', 'Pre-Tender', 'Tender', 'Construction', 'O&M', 'Other'];
const CONTRACT_TYPES = ['Work Contract', 'Service Contract', 'O&M Contract', 'Others'];
const PRIORITIES = ['High', 'Medium', 'Low', 'N/A'];

export function ProjectsFilterBar({
  filters,
  setFilter,
  clearAll,
  activeCount,
  totalRows,
}: Props): JSX.Element {
  const { data: lookups } = useGetLookupsQuery();

  return (
    <div className="space-y-2 rounded-lg border border-[#E5E7EB] bg-white p-3 shadow-sm">
      <div className="grid gap-2 lg:grid-cols-[1.5fr_repeat(6,_1fr)]">
        <label className="grid gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Search</span>
          <Input
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            placeholder="Name, city, contractor…"
          />
        </label>

        <Select
          label="Execution Status"
          value={filters.status}
          onChange={(v) => setFilter('status', v)}
          options={STATUSES}
        />
        <Select
          label="Stage"
          value={filters.projectStage}
          onChange={(v) => setFilter('projectStage', v)}
          options={STAGES}
        />
        <Select
          label="Contract Type"
          value={filters.contractType}
          onChange={(v) => setFilter('contractType', v)}
          options={CONTRACT_TYPES}
        />
        <Select
          label="Priority"
          value={filters.priority}
          onChange={(v) => setFilter('priority', v)}
          options={PRIORITIES}
        />
        <Select
          label="Sector"
          value={filters.sectorId}
          onChange={(v) => setFilter('sectorId', v)}
          options={
            lookups?.sectors.map((s) => ({ value: String(s.sectorId), label: s.sectorName })) ?? []
          }
        />
        <Select
          label="District"
          value={filters.districtId}
          onChange={(v) => setFilter('districtId', v)}
          options={
            lookups?.districts.map((d) => ({
              value: String(d.districtId),
              label: d.districtName,
            })) ?? []
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Select
          label="Region"
          value={filters.regionId}
          onChange={(v) => {
            // Changing region resets division so the sub-filter doesn't
            // point at a division outside the newly-picked region.
            setFilter('regionId', v);
            if (filters.divisionId) setFilter('divisionId', '');
          }}
          options={
            lookups?.regions.map((r) => ({ value: String(r.regionId), label: r.regionName })) ?? []
          }
          compact
        />
        <Select
          label="Division"
          value={filters.divisionId}
          onChange={(v) => setFilter('divisionId', v)}
          options={
            (lookups?.divisions ?? [])
              .filter((d) => !filters.regionId || String(d.regionId) === filters.regionId)
              .map((d) => ({ value: String(d.divisionId), label: d.divisionName }))
          }
          compact
        />
        <Select
          label="Scheme"
          value={filters.schemeId}
          onChange={(v) => setFilter('schemeId', v)}
          options={
            lookups?.schemes.map((s) => ({ value: String(s.schemeId), label: s.schemeName })) ?? []
          }
          compact
        />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-[#6B7280]">
            {activeCount > 0 ? (
              <>
                <span className="font-semibold text-[#1E3A5F]">{activeCount}</span> filter
                {activeCount === 1 ? '' : 's'} active
              </>
            ) : (
              'No filters'
            )}
            {typeof totalRows === 'number' ? (
              <>
                {' '}
                · <span className="font-semibold tabular-nums">{totalRows}</span> shown
              </>
            ) : null}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={clearAll}
            disabled={activeCount === 0}
            aria-label="Clear all filters"
          >
            Clear all
          </Button>
        </div>
      </div>
    </div>
  );
}

interface SelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<string | { value: string; label: string }>;
  compact?: boolean;
}

function Select({ label, value, onChange, options, compact }: SelectProps): JSX.Element {
  const normalized = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <label className={cn('grid gap-1', compact ? 'min-w-[200px]' : '')}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-9 w-full rounded border border-[#D1D5DB] bg-white px-2 text-sm text-[#111827]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-offset-1',
        )}
      >
        <option value="">All</option>
        {normalized.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
