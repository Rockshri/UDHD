import { useMemo, useState } from 'react';
import { useGetOmStatusQuery } from '../app/api/kpisApi';
import { useGetLookupsQuery } from '../app/api/lookupsApi';
import { ProjectProfileModal } from '../components/projects/ProjectProfileModal';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../lib/utils';
import { formatDate } from '../lib/formatters';
import type { OmStatusRow } from '../types/api';

const OM_STATUSES = ['Ongoing', 'Expiring Soon', 'Expired', 'Handed Over to ULB', 'Not Started'] as const;
type OmStatusFilter = (typeof OM_STATUSES)[number] | 'All';

const OM_PALETTE: Record<string, { bg: string; text: string; dot: string; ring: string }> = {
  'Not Started': { bg: 'bg-[#F3F4F6]', text: 'text-[#6B7280]', dot: 'bg-[#9CA3AF]', ring: 'ring-[#D1D5DB]' },
  Ongoing: { bg: 'bg-[#EFF6FF]', text: 'text-[#1D4ED8]', dot: 'bg-[#3B82F6]', ring: 'ring-[#93C5FD]' },
  'Expiring Soon': { bg: 'bg-[#FFFBEB]', text: 'text-[#B45309]', dot: 'bg-[#F59E0B]', ring: 'ring-[#FCD34D]' },
  Expired: { bg: 'bg-[#FEF2F2]', text: 'text-[#B91C1C]', dot: 'bg-[#EF4444]', ring: 'ring-[#FCA5A5]' },
  'Handed Over to ULB': {
    bg: 'bg-[#F0FDF4]',
    text: 'text-[#15803D]',
    dot: 'bg-[#22C55E]',
    ring: 'ring-[#86EFAC]',
  },
};

export function OmPage(): JSX.Element {
  const { data, isLoading } = useGetOmStatusQuery();
  const { data: lookups } = useGetLookupsQuery();

  const [statusFilter, setStatusFilter] = useState<OmStatusFilter>('All');
  const [search, setSearch] = useState('');
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);

  const items = data?.items ?? [];

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of OM_STATUSES) c[s] = 0;
    for (const r of items) {
      if (r.status && c[r.status] !== undefined) c[r.status] = (c[r.status] ?? 0) + 1;
    }
    return {
      total: items.length,
      Ongoing: c.Ongoing ?? 0,
      'Expiring Soon': c['Expiring Soon'] ?? 0,
      Expired: c.Expired ?? 0,
      'Handed Over to ULB': c['Handed Over to ULB'] ?? 0,
      'Not Started': c['Not Started'] ?? 0,
    };
  }, [items]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((r) => {
      if (statusFilter !== 'All' && r.status !== statusFilter) return false;
      if (term) {
        const name = (r.projectName ?? '').toLowerCase();
        const agency = (r.omAgency ?? '').toLowerCase();
        if (!name.includes(term) && !agency.includes(term)) return false;
      }
      return true;
    });
  }, [items, statusFilter, search]);

  return (
    <article className="space-y-4">
      <header>
        <h1 className="text-lg font-bold text-[#111827]">O&M — Operations &amp; Maintenance</h1>
        <p className="text-[12.5px] text-[#6B7280]">
          Tracks the post-completion O&M obligation period for Completed projects. Click any row to
          open its full profile.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <StatTile label="O&M Applicable" value={counts.total} tone="brand" filter="All" current={statusFilter} onClick={setStatusFilter} />
        <StatTile label="Ongoing" value={counts.Ongoing} tone="info" filter="Ongoing" current={statusFilter} onClick={setStatusFilter} />
        <StatTile
          label="Expiring Soon"
          value={counts['Expiring Soon']}
          tone="warn"
          filter="Expiring Soon"
          current={statusFilter}
          onClick={setStatusFilter}
        />
        <StatTile label="Expired" value={counts.Expired} tone="danger" filter="Expired" current={statusFilter} onClick={setStatusFilter} />
        <StatTile
          label="Handed Over to ULB"
          value={counts['Handed Over to ULB']}
          tone="success"
          filter="Handed Over to ULB"
          current={statusFilter}
          onClick={setStatusFilter}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['All', ...OM_STATUSES] as OmStatusFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={cn(
              'rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors',
              statusFilter === s
                ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white'
                : 'border-[#D1D5DB] bg-white text-[#6B7280] hover:text-[#374151]',
            )}
          >
            {s}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search project or agency…"
          className="ml-auto h-8 w-72 rounded border border-[#D1D5DB] px-3 text-[12.5px]"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4">
              <Skeleton className="h-40 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-[12.5px] text-[#6B7280]">
              {items.length === 0
                ? 'No O&M data recorded yet. Mark a Completed project\'s O&M Applicable as Yes and set the O&M Start Date / Period from the Input Sheet.'
                : 'No rows match the current filter.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse text-[12.5px]">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Project</th>
                    <th className="px-3 py-2 text-left">O&M Agency</th>
                    <th className="px-3 py-2 text-left">Start</th>
                    <th className="px-3 py-2 text-left">End</th>
                    <th className="px-3 py-2 text-right">Total (d)</th>
                    <th className="px-3 py-2 text-right">Elapsed</th>
                    <th className="px-3 py-2 text-right">Remaining</th>
                    <th className="px-3 py-2 text-left">Progress</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, idx) => (
                    <OmRow
                      key={r.projectId}
                      row={r}
                      idx={idx}
                      onOpen={() => setOpenProjectId(r.projectId)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!isLoading && items.length > 0 ? (
            <div className="border-t border-[#F3F4F6] bg-[#F9FAFB] px-4 py-2 text-[11px] text-[#6B7280]">
              {filtered.length} of {items.length} shown ·
              {lookups?.districts ? ' districts loaded' : ' loading district labels…'}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <ProjectProfileModal
        projectId={openProjectId}
        onClose={() => setOpenProjectId(null)}
      />
    </article>
  );
}

function StatTile({
  label,
  value,
  tone,
  filter,
  current,
  onClick,
}: {
  label: string;
  value: number;
  tone: 'brand' | 'info' | 'warn' | 'danger' | 'success';
  filter: OmStatusFilter;
  current: OmStatusFilter;
  onClick: (f: OmStatusFilter) => void;
}): JSX.Element {
  const palette: Record<typeof tone, string> = {
    brand: 'border-t-[#1E3A5F] text-[#1E3A5F]',
    info: 'border-t-[#1D4ED8] text-[#1D4ED8]',
    warn: 'border-t-[#B45309] text-[#B45309]',
    danger: 'border-t-[#B91C1C] text-[#B91C1C]',
    success: 'border-t-[#15803D] text-[#15803D]',
  };
  const active = current === filter;
  return (
    <button
      type="button"
      onClick={() => onClick(filter)}
      className={cn(
        'rounded border-t-4 border-x border-b bg-white px-3 py-2 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
        palette[tone],
        active ? 'border-x-[#1E3A5F] border-b-[#1E3A5F]' : 'border-x-[#E5E7EB] border-b-[#E5E7EB]',
      )}
      aria-pressed={active}
    >
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">{label}</div>
      <div className={cn('text-xl font-extrabold tabular-nums', palette[tone].split(' ').pop())}>
        {value}
      </div>
      {active ? (
        <div className="mt-0.5 text-[10px] font-semibold text-[#1D4ED8]">Filtering ↓</div>
      ) : null}
    </button>
  );
}

function OmRow({
  row,
  idx,
  onOpen,
}: {
  row: OmStatusRow;
  idx: number;
  onOpen: () => void;
}): JSX.Element {
  const pal = OM_PALETTE[row.status ?? 'Not Started'] ?? OM_PALETTE['Not Started']!;
  const pct = row.pctElapsed ?? 0;
  const remainingLabel =
    row.daysLeft === null
      ? '—'
      : row.daysLeft >= 0
        ? `${row.daysLeft}d left`
        : `${Math.abs(row.daysLeft)}d over`;

  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        'cursor-pointer border-b border-[#F3F4F6] hover:bg-[#F0F7FF] focus:bg-[#EFF6FF] focus:outline-none',
        idx % 2 === 1 && 'bg-[#FAFAFA]',
      )}
    >
      <td className="px-3 py-2 text-[#9CA3AF]">{idx + 1}</td>
      <td className="px-3 py-2 font-semibold text-[#1D4ED8]">{row.projectName ?? row.projectId}</td>
      <td className="px-3 py-2 text-[#374151]">{row.omAgency ?? '—'}</td>
      <td className="px-3 py-2 tabular-nums text-[#374151]">{formatDate(row.startDate)}</td>
      <td className="px-3 py-2 tabular-nums text-[#374151]">{formatDate(row.endDate)}</td>
      <td className="px-3 py-2 text-right tabular-nums text-[#374151]">{row.totalDays ?? '—'}</td>
      <td className="px-3 py-2 text-right tabular-nums text-[#374151]">{row.elapsedDays ?? '—'}</td>
      <td className="px-3 py-2 text-right tabular-nums text-[#374151]">{remainingLabel}</td>
      <td className="px-3 py-2 min-w-[140px]">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
          <div className={cn('h-full rounded-full', pal.dot)} style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 text-[10.5px] text-[#6B7280]">
          {pct}% elapsed
        </div>
      </td>
      <td className="px-3 py-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold',
            pal.bg,
            pal.text,
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', pal.dot)} />
          {row.status ?? '—'}
        </span>
      </td>
    </tr>
  );
}
