import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useListCosEotRecordsQuery } from '../app/api/kpisApi';
import { useGetLookupsQuery } from '../app/api/lookupsApi';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../lib/utils';
import { formatCurrencyCr, formatDate } from '../lib/formatters';
import type { CosCategory } from '../types/api';

const CATEGORIES: Array<CosCategory | 'All'> = [
  'All',
  'SCOPE ADDITION',
  'SCOPE DELETION',
  'DESIGN CHANGE',
  'QUANTITY VARIATION',
  'OTHERS',
];

const PAGE_SIZE = 25;

export function CosEotPage(): JSX.Element {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const { data, isLoading, isFetching } = useListCosEotRecordsQuery({
    limit: PAGE_SIZE,
    offset,
  });
  const lookups = useGetLookupsQuery();

  // Task 6 — Filter panel (replaces the old always-visible category chips).
  const [filterOpen, setFilterOpen] = useState(false);
  const [category, setCategory] = useState<CosCategory | 'All'>('All');
  const [sectorId, setSectorId] = useState<number | null>(null);
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [timeLinked, setTimeLinked] = useState<'Any' | 'Yes' | 'No'>('Any');
  const activeFilterCount =
    (category !== 'All' ? 1 : 0) + (sectorId !== null ? 1 : 0) +
    (districtId !== null ? 1 : 0) + (timeLinked !== 'Any' ? 1 : 0);
  const clearFilters = (): void => {
    setCategory('All');
    setSectorId(null);
    setDistrictId(null);
    setTimeLinked('Any');
  };

  const districtsById = useMemo(() => {
    const map = new Map<number, string>();
    for (const d of lookups.data?.districts ?? []) map.set(d.districtId, d.districtName);
    return map;
  }, [lookups.data]);
  const sectorsById = useMemo(() => {
    const map = new Map<number, string>();
    for (const s of lookups.data?.sectors ?? []) map.set(s.sectorId, s.sectorName);
    return map;
  }, [lookups.data]);

  const filteredItems = useMemo(() => {
    const raw = data?.items ?? [];
    const term = search.trim().toLowerCase();
    let subset = raw;
    if (category !== 'All') subset = subset.filter((r) => r.category === category);
    if (sectorId !== null) subset = subset.filter((r) => r.sectorId === sectorId);
    if (districtId !== null) subset = subset.filter((r) => r.districtId === districtId);
    if (timeLinked !== 'Any') {
      const want = timeLinked === 'Yes';
      subset = subset.filter((r) => Boolean(r.timeLinked) === want);
    }
    if (term) {
      subset = subset.filter((r) => {
        const name = (r.projectName ?? '').toLowerCase();
        const cn = (r.cosNumber ?? '').toLowerCase();
        const en = (r.eotNumber ?? '').toLowerCase();
        return name.includes(term) || cn.includes(term) || en.includes(term);
      });
    }
    return subset;
  }, [data, category, sectorId, districtId, timeLinked, search]);

  const totals = useMemo(() => {
    const raw = data?.items ?? [];
    return {
      pageCount: raw.length,
      totalAmount: raw.reduce((s, r) => s + (r.cosAmountCr ?? 0), 0),
      totalEotDays: raw.reduce((s, r) => s + (r.eotDaysGranted ?? 0), 0),
    };
  }, [data]);

  return (
    <article className="space-y-4">
      <header>
        <h1 className="text-lg font-bold text-[#111827]">Change of Scope / Extension of Time</h1>
        <p className="text-[12.5px] text-[#6B7280]">
          All CoS/EoT records across every project. Add/edit rows from a project's Input Sheet →
          Section 04.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <Metric label="Records on page" value={String(totals.pageCount)} tone="brand" />
        <Metric label="Total CoS value" value={formatCurrencyCr(totals.totalAmount)} tone="info" />
        <Metric label="Total EoT days" value={`${totals.totalEotDays} d`} tone="warn" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            aria-pressed={filterOpen}
            aria-expanded={filterOpen}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors',
              filterOpen || activeFilterCount > 0
                ? 'border-[#7C3AED] bg-[#7C3AED] text-white'
                : 'border-[#D1D5DB] bg-white text-[#6B7280] hover:text-[#374151]',
            )}
          >
            ▾ Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
          {filterOpen ? (
            <div className="absolute left-0 top-full z-20 mt-1.5 w-72 rounded-lg border border-[#E5E7EB] bg-white p-3 shadow-lg">
              <div className="space-y-2.5">
                <label className="grid gap-1 text-[12px] text-[#374151]">
                  Category
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as CosCategory | 'All')}
                    className="h-8 w-full rounded border border-[#D1D5DB] bg-white px-2 text-[12.5px]"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-[12px] text-[#374151]">
                  Sector
                  <select
                    value={sectorId === null ? '' : String(sectorId)}
                    onChange={(e) => setSectorId(e.target.value ? Number(e.target.value) : null)}
                    className="h-8 w-full rounded border border-[#D1D5DB] bg-white px-2 text-[12.5px]"
                  >
                    <option value="">All</option>
                    {(lookups.data?.sectors ?? []).map((s) => (
                      <option key={s.sectorId} value={s.sectorId}>{s.sectorName}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-[12px] text-[#374151]">
                  District
                  <select
                    value={districtId === null ? '' : String(districtId)}
                    onChange={(e) => setDistrictId(e.target.value ? Number(e.target.value) : null)}
                    className="h-8 w-full rounded border border-[#D1D5DB] bg-white px-2 text-[12.5px]"
                  >
                    <option value="">All</option>
                    {(lookups.data?.districts ?? []).map((d) => (
                      <option key={d.districtId} value={d.districtId}>{d.districtName}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-[12px] text-[#374151]">
                  Time linked
                  <select
                    value={timeLinked}
                    onChange={(e) => setTimeLinked(e.target.value as 'Any' | 'Yes' | 'No')}
                    className="h-8 w-full rounded border border-[#D1D5DB] bg-white px-2 text-[12.5px]"
                  >
                    <option value="Any">Any</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </label>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-[#F3F4F6] pt-2.5">
                <button
                  type="button"
                  onClick={clearFilters}
                  disabled={activeFilterCount === 0}
                  className="text-[11px] font-semibold text-[#B91C1C] hover:underline disabled:cursor-not-allowed disabled:text-[#D1D5DB]"
                >
                  Clear filters
                </button>
                <button
                  type="button"
                  onClick={() => setFilterOpen(false)}
                  className="rounded bg-[#7C3AED] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#6D28D9]"
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
          placeholder="Search project or CoS/EoT number…"
          className="ml-auto h-8 w-72 rounded border border-[#D1D5DB] px-3 text-[12.5px]"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4">
              <Skeleton className="h-40 w-full" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-6 text-center text-[12.5px] text-[#6B7280]">
              No CoS/EoT records match the current filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse text-[12.5px]">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Project</th>
                    <th className="px-3 py-2 text-left">Sector</th>
                    <th className="px-3 py-2 text-left">District</th>
                    <th className="px-3 py-2 text-left">CoS #</th>
                    <th className="px-3 py-2 text-left">CoS Date</th>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-right">Variation</th>
                    <th className="px-3 py-2 text-left">EoT #</th>
                    <th className="px-3 py-2 text-right">EoT Days</th>
                    <th className="px-3 py-2 text-left">Revised End</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((r, idx) => (
                    <tr
                      key={r.cosId}
                      className={cn(
                        'border-b border-[#F3F4F6] hover:bg-[#F9FAFB]',
                        idx % 2 === 1 && 'bg-[#FAFAFA]',
                      )}
                    >
                      <td className="px-3 py-2 text-[#9CA3AF]">{offset + idx + 1}</td>
                      <td className="px-3 py-2">
                        <NavLink
                          to={`/projects/${r.projectId}`}
                          className="font-semibold text-[#1D4ED8] hover:underline"
                        >
                          {r.projectName ?? r.projectId}
                        </NavLink>
                      </td>
                      <td className="px-3 py-2 text-[#374151]">
                        {r.sectorId ? sectorsById.get(r.sectorId) ?? `#${r.sectorId}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-[#374151]">
                        {r.districtId ? districtsById.get(r.districtId) ?? `#${r.districtId}` : '—'}
                      </td>
                      <td className="px-3 py-2 font-semibold text-[#7C3AED]">
                        {r.cosNumber ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-[#374151]">{formatDate(r.cosDate)}</td>
                      <td className="px-3 py-2 text-[#374151]">{r.category ?? '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[#1E3A5F]">
                        {formatCurrencyCr(r.cosAmountCr)}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2 text-right tabular-nums font-semibold',
                          (r.variationPct ?? 0) > 0 ? 'text-[#059669]' : 'text-[#6B7280]',
                        )}
                      >
                        {r.variationPct !== null ? `${r.variationPct}%` : '—'}
                      </td>
                      <td className="px-3 py-2 text-[#374151]">{r.eotNumber ?? '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[#2563EB]">
                        {r.eotDaysGranted ?? 0} d
                      </td>
                      <td className="px-3 py-2 text-[#374151]">
                        {formatDate(r.revisedDate ?? r.newEndDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-[#F3F4F6] bg-[#F9FAFB] px-4 py-2 text-[11.5px] text-[#6B7280]">
            <Button
              size="xs"
              variant="outline"
              onClick={() => setOffset(0)}
              disabled={offset === 0 || isFetching}
            >
              ⏮ First page
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0 || isFetching}
            >
              ← Prev
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => data?.nextOffset !== null && setOffset(data?.nextOffset ?? offset)}
              disabled={data?.nextOffset === null || isFetching}
            >
              Next →
            </Button>
            <span className="ml-2 tabular-nums">
              Offset {offset} · {data?.items.length ?? 0} shown
              {isFetching ? ' · loading…' : ''}
            </span>
          </div>
        </CardContent>
      </Card>
    </article>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'brand' | 'info' | 'warn';
}): JSX.Element {
  const palette: Record<typeof tone, string> = {
    brand: 'border-t-[#1E3A5F] text-[#1E3A5F]',
    info: 'border-t-[#1D4ED8] text-[#1D4ED8]',
    warn: 'border-t-[#B45309] text-[#B45309]',
  };
  return (
    <div
      className={cn(
        'rounded border-t-4 border-x border-b border-[#E5E7EB] bg-white px-3 py-2 shadow-sm',
        palette[tone],
      )}
    >
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">{label}</div>
      <div className={cn('text-xl font-extrabold tabular-nums', palette[tone].split(' ').pop())}>
        {value}
      </div>
    </div>
  );
}
