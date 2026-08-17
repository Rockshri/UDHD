import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useGetSectorSummaryQuery } from '../app/api/kpisApi';
import { useCreateSectorMutation } from '../app/api/lookupsApi';
import { useAppSelector } from '../app/hooks';
import { selectCurrentUser } from '../features/auth/authSlice';
import { AddLookupModal } from '../components/summary/AddLookupModal';
import { DrillTable } from '../components/summary/DrillTable';
import { MetricButton } from '../components/summary/MetricButton';
import { SummaryCard, type SummaryCardMetric } from '../components/summary/SummaryCard';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../lib/utils';

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
];

/**
 * Drill state is a single field that can hold either:
 *   - { sectorId: null, metric }   → top-row drill (all sectors)
 *   - { sectorId: X, metric }      → per-sector drill
 * Only one drill visible at a time; clicking the currently-active source
 * again closes it.
 */
type DrillState = { sectorId: number | null; metric: SummaryCardMetric };

export function SectorsPage(): JSX.Element {
  const summary = useGetSectorSummaryQuery();
  const [drill, setDrill] = useState<DrillState | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const currentUser = useAppSelector(selectCurrentUser);
  const canManage = currentUser?.role === 'MD' || currentUser?.role === 'Admin';
  const [createSector, createSectorState] = useCreateSectorMutation();

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

  const selectedSector = drill?.sectorId != null
    ? summary.data?.items.find((r) => r.sectorId === drill.sectorId) ?? null
    : null;

  // Helper: same-source-same-metric toggles off; otherwise switches to new source.
  const toggleDrill = (next: DrillState): void => {
    setDrill((prev) =>
      prev && prev.sectorId === next.sectorId && prev.metric === next.metric
        ? null
        : next,
    );
  };

  const topActiveMetric = drill && drill.sectorId === null ? drill.metric : null;

  return (
    <article className="space-y-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#111827]">Sector-wise Summary</h1>
          <p className="text-[12.5px] text-[#6B7280]">
            Click any card to drill into projects — either portfolio-wide or scoped to a sector.
          </p>
        </div>
        {canManage ? (
          <Button variant="default" size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={14} aria-hidden />
            Add Sector
          </Button>
        ) : null}
      </header>

      <AddLookupModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Sector"
        fieldLabel="Sector name"
        placeholder="e.g. Water Supply"
        maxLength={40}
        saving={createSectorState.isLoading}
        onSave={async (sectorName) => {
          await createSector({ sectorName }).unwrap();
        }}
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {/* Sectors count is a category count, not a project drill → plain label. */}
        <SectorsCountCard value={totals.sectors} />
        <MetricButton
          label="Projects"
          value={totals.projects}
          tone="brand"
          active={topActiveMetric === 'total'}
          onClick={() => toggleDrill({ sectorId: null, metric: 'total' })}
        />
        <MetricButton
          label="Completed"
          value={totals.completed}
          tone="success"
          active={topActiveMetric === 'completed'}
          onClick={() => toggleDrill({ sectorId: null, metric: 'completed' })}
        />
        <MetricButton
          label="In Progress"
          value={totals.inProgress}
          tone="info"
          active={topActiveMetric === 'inProgress'}
          onClick={() => toggleDrill({ sectorId: null, metric: 'inProgress' })}
        />
        <MetricButton
          label="Delayed"
          value={totals.delayed}
          tone="danger"
          active={topActiveMetric === 'delayed'}
          onClick={() => toggleDrill({ sectorId: null, metric: 'delayed' })}
        />
      </div>

      {/* Top-row drill renders here — directly below the aggregate cards. */}
      {drill && drill.sectorId === null ? (
        <DrillTable
          status={METRIC_TO_STATUS[drill.metric]}
          labelOfContext={`All Sectors · ${METRIC_LABEL[drill.metric]}`}
          onClose={() => setDrill(null)}
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
              active={false}
              activeMetric={
                drill?.sectorId === row.sectorId ? drill.metric : null
              }
              onMetricClick={(metric) =>
                toggleDrill({ sectorId: row.sectorId, metric })
              }
            />
          ))}
        </div>
      )}

      {/* Per-entity drill renders here — directly below the per-sector grid. */}
      {drill && selectedSector ? (
        <DrillTable
          sectorId={selectedSector.sectorId}
          status={METRIC_TO_STATUS[drill.metric]}
          labelOfContext={`${selectedSector.sectorName} · ${METRIC_LABEL[drill.metric]}`}
          onClose={() => setDrill(null)}
        />
      ) : null}
    </article>
  );
}

/** Plain informational card for the sectors count (no project drill). */
function SectorsCountCard({ value }: { value: number }): JSX.Element {
  return (
    <div
      className={cn(
        'rounded border-t-4 border-x border-b border-[#E5E7EB] border-t-[#1E3A5F] bg-white px-3 py-2 shadow-sm',
      )}
    >
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">
        Sectors
      </div>
      <div className="text-xl font-extrabold tabular-nums text-[#1E3A5F]">{value}</div>
      <div className="mt-0.5 text-[10.5px] text-[#9CA3AF]">Total categories</div>
    </div>
  );
}
