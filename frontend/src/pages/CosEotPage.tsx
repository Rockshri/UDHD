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
  const [category, setCategory] = useState<CosCategory | 'All'>('All');
  const [search, setSearch] = useState('');
  const { data, isLoading, isFetching } = useListCosEotRecordsQuery({
    limit: PAGE_SIZE,
    offset,
  });
  const lookups = useGetLookupsQuery();

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
    if (term) {
      subset = subset.filter((r) => {
        const name = (r.projectName ?? '').toLowerCase();
        const cn = (r.cosNumber ?? '').toLowerCase();
        const en = (r.eotNumber ?? '').toLowerCase();
        return name.includes(term) || cn.includes(term) || en.includes(term);
      });
    }
    return subset;
  }, [data, category, search]);

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
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cn(
              'rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors',
              category === c
                ? 'border-[#7C3AED] bg-[#7C3AED] text-white'
                : 'border-[#D1D5DB] bg-white text-[#6B7280] hover:text-[#374151]',
            )}
          >
            {c}
          </button>
        ))}
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
