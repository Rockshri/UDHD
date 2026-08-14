import { useMemo, useState } from 'react';
import { useGetSchemeSummaryQuery, useGetSchemeChartQuery } from '../app/api/kpisApi';
import { DrillTable } from '../components/summary/DrillTable';
import { MetricButton } from '../components/summary/MetricButton';
import { SummaryCard, type SummaryCardMetric } from '../components/summary/SummaryCard';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../lib/utils';
import { formatPercent } from '../lib/formatters';

const METRIC_TO_STATUS: Record<SummaryCardMetric, string | undefined> = {
  total: undefined,
  completed: 'Completed',
  inProgress: 'In Progress',
  delayed: 'Delayed',
};

const METRIC_LABEL: Record<SummaryCardMetric, string> = {
  total: 'All Projects',
  completed: 'Completed',
  inProgress: 'In Progress',
  delayed: 'Delayed',
};

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

/**
 * Mirrors the SectorsPage drill state — either a top-row drill
 * (schemeId: null) or a per-scheme drill. Only one visible at a time.
 */
type DrillState = { schemeId: number | null; metric: SummaryCardMetric };

export function SchemesPage(): JSX.Element {
  const summary = useGetSchemeSummaryQuery();
  const chart = useGetSchemeChartQuery();
  const [drill, setDrill] = useState<DrillState | null>(null);

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

  const selectedScheme = drill?.schemeId != null
    ? summary.data?.items.find((r) => r.schemeId === drill.schemeId) ?? null
    : null;

  const toggleDrill = (next: DrillState): void => {
    setDrill((prev) =>
      prev && prev.schemeId === next.schemeId && prev.metric === next.metric
        ? null
        : next,
    );
  };

  const topActiveMetric = drill && drill.schemeId === null ? drill.metric : null;

  return (
    <article className="space-y-4">
      <header>
        <h1 className="text-lg font-bold text-[#111827]">Scheme-wise Summary</h1>
        <p className="text-[12.5px] text-[#6B7280]">
          Click any card to drill into projects — either portfolio-wide or scoped to a scheme.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <SchemesCountCard value={totals.schemes} />
        <MetricButton
          label="Projects"
          value={totals.projects}
          tone="brand"
          active={topActiveMetric === 'total'}
          onClick={() => toggleDrill({ schemeId: null, metric: 'total' })}
        />
        <MetricButton
          label="Completed"
          value={totals.completed}
          tone="success"
          active={topActiveMetric === 'completed'}
          onClick={() => toggleDrill({ schemeId: null, metric: 'completed' })}
        />
        <MetricButton
          label="In Progress"
          value={totals.inProgress}
          tone="info"
          active={topActiveMetric === 'inProgress'}
          onClick={() => toggleDrill({ schemeId: null, metric: 'inProgress' })}
        />
        <MetricButton
          label="Delayed"
          value={totals.delayed}
          tone="danger"
          active={topActiveMetric === 'delayed'}
          onClick={() => toggleDrill({ schemeId: null, metric: 'delayed' })}
        />
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
                active={false}
                activeMetric={drill?.schemeId === row.schemeId ? drill.metric : null}
                onMetricClick={(metric) =>
                  toggleDrill({ schemeId: row.schemeId, metric })
                }
              />
            );
          })}
        </div>
      )}

      {drill ? (
        <DrillTable
          {...(selectedScheme ? { schemeId: selectedScheme.schemeId } : {})}
          status={METRIC_TO_STATUS[drill.metric]}
          labelOfContext={
            selectedScheme
              ? `${selectedScheme.schemeName} · ${METRIC_LABEL[drill.metric]}`
              : `All Schemes · ${METRIC_LABEL[drill.metric]}`
          }
          onClose={() => setDrill(null)}
        />
      ) : null}
    </article>
  );
}

/** Plain informational card for the schemes count (no project drill). */
function SchemesCountCard({ value }: { value: number }): JSX.Element {
  return (
    <div
      className={cn(
        'rounded border-t-4 border-x border-b border-[#E5E7EB] border-t-[#1E3A5F] bg-white px-3 py-2 shadow-sm',
      )}
    >
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">
        Schemes
      </div>
      <div className="text-xl font-extrabold tabular-nums text-[#1E3A5F]">{value}</div>
      <div className="mt-0.5 text-[10.5px] text-[#9CA3AF]">Total categories</div>
    </div>
  );
}
