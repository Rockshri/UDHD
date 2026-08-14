import { cn } from '../../lib/utils';

/**
 * Clickable top-row KPI card used on the Divisions / Sectors / Schemes
 * summary pages. Same visual language as the plain Metric label but with
 * hover lift, focus ring, and a "Showing" pill when active. Clicking
 * toggles a filtered project list rendered by the parent.
 */

export type MetricButtonTone = 'brand' | 'success' | 'danger' | 'info';

interface Props {
  label: string;
  value: number;
  tone: MetricButtonTone;
  active: boolean;
  onClick: () => void;
  /** Sub-copy under the value. Defaults to hint text tied to `active`. */
  hint?: string | undefined;
}

const PALETTE: Record<MetricButtonTone, { border: string; text: string; ring: string }> = {
  brand:   { border: 'border-t-[#1E3A5F]', text: 'text-[#1E3A5F]', ring: 'ring-[#1E3A5F]' },
  success: { border: 'border-t-[#15803D]', text: 'text-[#15803D]', ring: 'ring-[#15803D]' },
  danger:  { border: 'border-t-[#B91C1C]', text: 'text-[#B91C1C]', ring: 'ring-[#B91C1C]' },
  info:    { border: 'border-t-[#1D4ED8]', text: 'text-[#1D4ED8]', ring: 'ring-[#1D4ED8]' },
};

export function MetricButton({ label, value, tone, active, onClick, hint }: Props): JSX.Element {
  const p = PALETTE[tone];
  const defaultHint = active ? 'Click again to hide list' : 'Click to view projects';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'group rounded border-t-4 border-x border-b border-[#E5E7EB] bg-white px-3 py-2 text-left shadow-sm transition-all',
        'hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1',
        p.border,
        p.ring,
        active ? 'ring-2 ring-offset-1' : '',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">
          {label}
        </div>
        {active ? (
          <span className="rounded-full bg-[#1E3A5F] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-white">
            Showing
          </span>
        ) : null}
      </div>
      <div className={cn('text-xl font-extrabold tabular-nums', p.text)}>{value}</div>
      <div className="mt-0.5 text-[10.5px] text-[#6B7280] group-hover:text-[#374151]">
        {hint ?? defaultHint}
      </div>
    </button>
  );
}
