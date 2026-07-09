import { useGetScheduleVsActualQuery } from '../../app/api/kpisApi';
import { formatPercent } from '../../lib/formatters';
import { cn } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';

export function ScheduleVsActualCard(): JSX.Element {
  const { data, isLoading, error } = useGetScheduleVsActualQuery();

  const actual = data?.avgActualPct ?? 0;
  const scheduled = data?.avgScheduledPctEffective ?? 0;
  const delta = actual - scheduled;
  const onSchedule = delta >= -0.5; // within half a percent counts as on-track

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Schedule vs Actual</CardTitle>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
          Portfolio average
        </span>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : error ? (
          <p className="text-sm text-[#B91C1C]">Could not load schedule KPIs.</p>
        ) : (
          <div className="space-y-3">
            <ProgressRow
              label="Scheduled progress"
              value={scheduled}
              color="#6366F1"
              hint={
                data?.projectsWithSchedule && data.projectsWithSchedule > 0
                  ? `Based on ${data.projectsWithSchedule} project${data.projectsWithSchedule === 1 ? '' : 's'} with a schedule`
                  : 'Fallback: no scheduled % entered'
              }
            />
            <ProgressRow label="Actual physical progress" value={actual} color="#1E3A5F" />
            <div
              className={cn(
                'flex items-center justify-between rounded border px-3 py-2 text-sm',
                onSchedule
                  ? 'border-[#86EFAC] bg-[#F0FDF4] text-[#15803D]'
                  : 'border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]',
              )}
            >
              <span className="font-semibold">
                {onSchedule ? '✓ On schedule' : `▼ Behind schedule`}
              </span>
              <span className="tabular-nums font-bold">
                {delta >= 0 ? '+' : ''}
                {delta.toFixed(1)} pp
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProgressRow({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: number;
  color: string;
  hint?: string;
}): JSX.Element {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium text-[#374151]">{label}</span>
        <span className="text-sm font-bold tabular-nums" style={{ color }}>
          {formatPercent(value)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#F3F4F6]">
        <div
          className="h-full transition-all"
          style={{ width: `${clamped}%`, backgroundColor: color }}
          role="progressbar"
          aria-label={label}
          aria-valuenow={Math.round(clamped)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {hint ? <p className="mt-0.5 text-[10.5px] text-[#6B7280]">{hint}</p> : null}
    </div>
  );
}
