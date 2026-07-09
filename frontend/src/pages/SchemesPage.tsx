import { useMemo, useState } from 'react';
import { useGetSchemeSummaryQuery, useGetSchemeChartQuery } from '../app/api/kpisApi';
import { DrillTable } from '../components/summary/DrillTable';
import { SummaryCard } from '../components/summary/SummaryCard';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../lib/utils';
import { formatPercent } from '../lib/formatters';

const CARD_COLORS = [
  '#1E3A5F',
  '#2563EB',
  '#3B82F6',
  '#60A5FA',
  '#93C5FD',
  '#A5B4FC',
  '#C7D2FE',
  '#7C3AED',
];

export function SchemesPage(): JSX.Element {
  const summary = useGetSchemeSummaryQuery();
  const chart = useGetSchemeChartQuery();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const totals = useMemo(() => {
    const items = summary.data?.items ?? [];
    return {
      schemes: items.length,
      projects: items.reduce((s, r) => s + r.total, 0),
      completed: items.reduce((s, r) => s + r.completed, 0),
      inProgress: items.reduce((s, r) => s + r.inProgress, 0),
      delayed: items.reduce((s, r) => s + r.delayed, 0),
    };
  }, [summary.data]);

  const chartById = useMemo(() => {
    const map = new Map<
      number,
      {
        avgPhysicalPct: number | null;
        avgFinancialPct: number | null;
        totalAgreementCr: number | null;
        totalFinancialCr: number | null;
      }
    >();
    for (const c of chart.data?.items ?? []) {
      map.set(c.schemeId, {
        avgPhysicalPct: c.avgPhysicalPct,
        avgFinancialPct: c.avgFinancialPct,
        totalAgreementCr: c.totalAgreementCr,
        totalFinancialCr: c.totalFinancialCr,
      });
    }
    return map;
  }, [chart.data]);

  const selected = selectedId
    ? summary.data?.items.find((r) => r.schemeId === selectedId) ?? null
    : null;

  return (
    <article className="space-y-4">
      <header>
        <h1 className="text-lg font-bold text-[#111827]">Scheme-wise Summary</h1>
        <p className="text-[12.5px] text-[#6B7280]">
          Click a scheme card to drill into its projects.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Metric label="Schemes" value={totals.schemes} tone="brand" />
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
            No schemes configured yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(summary.data?.items ?? []).map((row, idx) => {
            const chartEntry = chartById.get(row.schemeId);
            return (
              <SummaryCard
                key={row.schemeId}
                name={row.schemeName}
                color={CARD_COLORS[idx % CARD_COLORS.length] ?? '#1E3A5F'}
                total={row.total}
                completed={row.completed}
                inProgress={row.inProgress}
                delayed={row.delayed}
                extraStat={
                  chartEntry?.avgPhysicalPct !== null && chartEntry?.avgPhysicalPct !== undefined
                    ? { label: 'Avg physical', value: formatPercent(chartEntry.avgPhysicalPct) }
                    : undefined
                }
                money={
                  chartEntry
                    ? {
                        allotedCr: chartEntry.totalAgreementCr,
                        spentCr: chartEntry.totalFinancialCr,
                      }
                    : undefined
                }
                active={selectedId === row.schemeId}
                onClick={() =>
                  setSelectedId(selectedId === row.schemeId ? null : row.schemeId)
                }
              />
            );
          })}
        </div>
      )}

      {selected ? (
        <DrillTable
          schemeId={selected.schemeId}
          labelOfContext={selected.schemeName}
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
