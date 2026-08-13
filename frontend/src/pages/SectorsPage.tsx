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

/** The five portfolio-metric blocks (Task 2) — each drills into the
 *  matching slice of projects across every sector. */
type MetricKey = 'sectors' | 'projects' | 'completed' | 'inProgress' | 'delayed';

const METRIC_LABELS: Record<MetricKey, string> = {
  sectors: 'All projects — across all sectors',
  projects: 'All projects',
  completed: 'Completed projects',
  inProgress: 'In-progress projects',
  delayed: 'Delayed projects',
};

const METRIC_STATUS: Partial<Record<MetricKey, string>> = {
  completed: 'Completed',
  inProgress: 'In Progress',
  delayed: 'Delayed',
};

export function SectorsPage(): JSX.Element {
  const summary = useGetSectorSummaryQuery();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeMetric, setActiveMetric] = useState<MetricKey | null>(null);

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
        <Metric
          label="Sectors"
          value={totals.sectors}
          tone="brand"
          active={activeMetric === 'sectors'}
          onClick={() => {
            setSelectedId(null);
            setActiveMetric((k) => (k === 'sectors' ? null : 'sectors'));
          }}
        />
        <Metric
          label="Projects"
          value={totals.projects}
          tone="brand"
          active={activeMetric === 'projects'}
          onClick={() => {
            setSelectedId(null);
            setActiveMetric((k) => (k === 'projects' ? null : 'projects'));
          }}
        />
        <Metric
          label="Completed"
          value={totals.completed}
          tone="success"
          active={activeMetric === 'completed'}
          onClick={() => {
            setSelectedId(null);
            setActiveMetric((k) => (k === 'completed' ? null : 'completed'));
          }}
        />
        <Metric
          label="In Progress"
          value={totals.inProgress}
          tone="info"
          active={activeMetric === 'inProgress'}
          onClick={() => {
            setSelectedId(null);
            setActiveMetric((k) => (k === 'inProgress' ? null : 'inProgress'));
          }}
        />
        <Metric
          label="Delayed"
          value={totals.delayed}
          tone="danger"
          active={activeMetric === 'delayed'}
          onClick={() => {
            setSelectedId(null);
            setActiveMetric((k) => (k === 'delayed' ? null : 'delayed'));
          }}
        />
      </div>

      {activeMetric ? (
        <DrillTable
          {...(METRIC_STATUS[activeMetric] ? { status: METRIC_STATUS[activeMetric] } : {})}
          labelOfContext={METRIC_LABELS[activeMetric]}
          onClose={() => setActiveMetric(null)}
        />
      ) : null}

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
              onClick={() => {
                setActiveMetric(null);
                setSelectedId(selectedId === row.sectorId ? null : row.sectorId);
              }}
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
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone: 'brand' | 'info' | 'success' | 'danger';
  active?: boolean;
  onClick?: () => void;
}): JSX.Element {
  const palette: Record<typeof tone, { border: string; text: string; activeBg: string }> = {
    brand: { border: 'border-t-[#1E3A5F]', text: 'text-[#1E3A5F]', activeBg: 'bg-[#1E3A5F]' },
    info: { border: 'border-t-[#1D4ED8]', text: 'text-[#1D4ED8]', activeBg: 'bg-[#1D4ED8]' },
    success: { border: 'border-t-[#15803D]', text: 'text-[#15803D]', activeBg: 'bg-[#15803D]' },
    danger: { border: 'border-t-[#B91C1C]', text: 'text-[#B91C1C]', activeBg: 'bg-[#B91C1C]' },
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
