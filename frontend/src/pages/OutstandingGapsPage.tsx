import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useGetOutstandingGapsQuery } from '../app/api/kpisApi';
import { useGetLookupsQuery } from '../app/api/lookupsApi';
import { PriorityBadge } from '../components/projects/PriorityBadge';
import { StatusBadge } from '../components/projects/StatusBadge';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../lib/utils';
import type { Priority } from '../types/api';

const PRIORITY_FILTERS: Array<Priority | 'All'> = ['All', 'High', 'Medium', 'Low', 'N/A'];

export function OutstandingGapsPage(): JSX.Element {
  const { data, isLoading } = useGetOutstandingGapsQuery();
  const lookups = useGetLookupsQuery();
  const [priority, setPriority] = useState<Priority | 'All'>('All');
  const [search, setSearch] = useState('');

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

  const rows = useMemo(() => {
    const all = data?.items ?? [];
    const term = search.trim().toLowerCase();
    let subset = all;
    if (priority !== 'All') subset = subset.filter((r) => (r.priority ?? 'N/A') === priority);
    if (term) {
      subset = subset.filter((r) => {
        const name = (r.projectName ?? '').toLowerCase();
        const remark = (r.remark ?? '').toLowerCase();
        return name.includes(term) || remark.includes(term);
      });
    }
    return subset;
  }, [data, priority, search]);

  const counts = useMemo(() => {
    const all = data?.items ?? [];
    const byPri: Record<Priority, number> = { High: 0, Medium: 0, Low: 0, 'N/A': 0 };
    for (const r of all) {
      const key = (r.priority ?? 'N/A') as Priority;
      byPri[key] = (byPri[key] ?? 0) + 1;
    }
    return byPri;
  }, [data]);

  return (
    <article className="space-y-4">
      <header>
        <h1 className="text-lg font-bold text-[#111827]">Outstanding Gaps</h1>
        <p className="text-[12.5px] text-[#6B7280]">
          Projects flagged with an outstanding gap (Input Sheet → Section 07 → "Yes — Gap Exists").
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {PRIORITY_FILTERS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPriority(p)}
            className={cn(
              'rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors',
              priority === p
                ? 'border-[#B91C1C] bg-[#B91C1C] text-white'
                : 'border-[#D1D5DB] bg-white text-[#6B7280] hover:text-[#374151]',
            )}
          >
            {p}
            {p !== 'All' && counts[p] > 0 ? (
              <span className="ml-1 text-[10.5px] opacity-80">({counts[p]})</span>
            ) : null}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search project or remark…"
          className="ml-auto h-8 w-72 rounded border border-[#D1D5DB] px-3 text-[12.5px]"
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
              {priority === 'All' && !search
                ? 'No outstanding gaps recorded. 🎉'
                : 'No gaps match the current filter.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-[12.5px]">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">
                    <th className="px-4 py-2 text-left">#</th>
                    <th className="px-4 py-2 text-left">Project</th>
                    <th className="px-4 py-2 text-left">Sector</th>
                    <th className="px-4 py-2 text-left">District</th>
                    <th className="px-4 py-2 text-left">Priority</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Gap / Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr
                      key={r.projectId}
                      className={cn(
                        'border-b border-[#F3F4F6] align-top hover:bg-[#F9FAFB]',
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
                      <td className="px-4 py-2 text-[#374151]">
                        {r.sectorId ? sectorsById.get(r.sectorId) ?? `#${r.sectorId}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-[#374151]">
                        {r.districtId ? districtsById.get(r.districtId) ?? `#${r.districtId}` : '—'}
                      </td>
                      <td className="px-4 py-2">
                        <PriorityBadge priority={r.priority} />
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-2 text-[#B91C1C]">
                        <span className="mr-1">⚠</span>
                        <span className="whitespace-pre-line">{r.remark ?? '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </article>
  );
}
