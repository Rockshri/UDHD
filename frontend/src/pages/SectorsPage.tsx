import { useMemo, useState } from 'react';
import { useGetSectorSummaryQuery } from '../app/api/kpisApi';
import { DrillTable } from '../components/summary/DrillTable';
import { SummaryCard } from '../components/summary/SummaryCard';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../lib/utils';

const CARD_COLORS = [
  '#1E3A5F',
  '#2563EB',
  '#3B82F6',
  '#60A5FA',
  '#93C5FD',
];

export function SectorsPage(): JSX.Element {
  const summary = useGetSectorSummaryQuery();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const totals = useMemo(() => {
    const items = summary.data?.items ?? [];
    return {
      sectors: items.length,
      projects: items.reduce((s, r) => s + r.total, 0),
      completed: items.reduce((s, r) => s + r.completed, 0),
      inProgress: items.reduce((s, r) => s + r.inProgress, 0),
      delayed: items.reduce((s, r) => s + r.delayed, 0),
    };
  }, [summary.data]);

  const selected = selectedId
    ? summary.data?.items.find((r) => r.sectorId === selectedId) ?? null
    : null;

  return (
    <article className="space-y-4">
      <header>
        <h1 className="text-lg font-bold text-[#111827]">Sector-wise Summary</h1>
        <p className="text-[12.5px] text-[#6B7280]">
          Click a sector card to drill into its projects.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Metric label="Sectors" value={totals.sectors} tone="brand" />
        <Metric label="Projects" value={totals.projects} tone="brand" />
        <Metric label="Completed" value={totals.completed} tone="success" />
        <Metric label="In Progress" value={totals.inProgress} tone="info" />
        <Metric label="Delayed" value={totals.delayed} tone="danger" />
      </div>

      {summary.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (summary.data?.items ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-[12.5px] text-[#6B7280]">
            No sectors configured yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(summary.data?.items ?? []).map((row, idx) => (
            <SummaryCard
              key={row.sectorId}
              name={row.sectorName}
              color={CARD_COLORS[idx % CARD_COLORS.length] ?? '#1E3A5F'}
              total={row.total}
              completed={row.completed}
              inProgress={row.inProgress}
              delayed={row.delayed}
              active={selectedId === row.sectorId}
              onClick={() =>
                setSelectedId(selectedId === row.sectorId ? null : row.sectorId)
              }
            />
          ))}
        </div>
      )}

      {selected ? (
        <DrillTable
          sectorId={selected.sectorId}
          labelOfContext={selected.sectorName}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </article>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'brand' | 'info' | 'success' | 'danger';
}): JSX.Element {
  const palette: Record<typeof tone, { border: string; text: string }> = {
    brand: { border: 'border-t-[#1E3A5F]', text: 'text-[#1E3A5F]' },
    info: { border: 'border-t-[#1D4ED8]', text: 'text-[#1D4ED8]' },
    success: { border: 'border-t-[#15803D]', text: 'text-[#15803D]' },
    danger: { border: 'border-t-[#B91C1C]', text: 'text-[#B91C1C]' },
  };
  const p = palette[tone];
  return (
    <div
      className={cn(
        'rounded border-t-4 border-x border-b border-[#E5E7EB] bg-white px-3 py-2 shadow-sm',
        p.border,
      )}
    >
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">
        {label}
      </div>
      <div className={cn('text-xl font-extrabold tabular-nums', p.text)}>{value}</div>
    </div>
  );
}
