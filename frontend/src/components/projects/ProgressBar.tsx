import { cn } from '../../lib/utils';

interface ProgressBarProps {
  value: number | null | undefined;
  color?: string;
  showLabel?: boolean;
  className?: string;
}

/** Inline horizontal progress bar with a numeric label above. */
export function ProgressBar({
  value,
  color = '#3B82F6',
  showLabel = true,
  className,
}: ProgressBarProps): JSX.Element {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  const empty = value === null || value === undefined;
  return (
    <div className={cn('flex min-w-[70px] flex-col gap-0.5', className)}>
      {showLabel ? (
        <span className="text-[10.5px] font-semibold tabular-nums text-[#374151]">
          {empty ? '—' : `${pct.toFixed(1)}%`}
        </span>
      ) : null}
      <div
        className="h-1.5 overflow-hidden rounded-full bg-[#F3F4F6]"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
