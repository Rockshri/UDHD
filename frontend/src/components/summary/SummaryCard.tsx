import { cn } from '../../lib/utils';

export interface MoneyStrip {
  allotedCr: number | null;
  spentCr: number | null;
}

export type SummaryCardMetric = 'total' | 'completed' | 'inProgress' | 'delayed';

interface Props {
  name: string;
  color: string;
  total: number;
  completed?: number;
  inProgress?: number;
  delayed?: number;
  extraStat?: { label: string; value: string } | undefined;
  money?: MoneyStrip | undefined;
  active: boolean;
  /**
   * Legacy whole-card click handler. Districts/Divisions still use this to
   * open a single drill-in showing all projects for the row.
   */
  onClick?: () => void;
  /**
   * When set, each metric (total number + status pips) becomes independently
   * clickable and fires `onMetricClick(metric)`. Used by Sector/Scheme pages
   * so users can drill into a specific status directly (spec §1–§3).
   */
  onMetricClick?: (metric: SummaryCardMetric) => void;
  /** Which per-metric drill is currently open. Only meaningful with `onMetricClick`. */
  activeMetric?: SummaryCardMetric | null;
}

/**
 * Card used by the Schemes / Sectors / Districts summary grids. Matches
 * the reference JSX visual language (accent-tinted count, coloured status
 * pips underneath). Active state flips the card to solid navy.
 */
const inrShort = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

function fmtCr(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return `₹ ${inrShort.format(v)} Cr`;
}

export function SummaryCard({
  name,
  color,
  total,
  completed = 0,
  inProgress = 0,
  delayed = 0,
  extraStat,
  money,
  active,
  onClick,
  onMetricClick,
  activeMetric = null,
}: Props): JSX.Element {
  const utilPct =
    money && money.allotedCr !== null && money.spentCr !== null && money.allotedCr > 0
      ? Math.round((money.spentCr / money.allotedCr) * 1000) / 10
      : null;
  const utilColor =
    utilPct === null
      ? '#9CA3AF'
      : utilPct < 40
        ? '#B91C1C'
        : utilPct < 70
          ? '#B45309'
          : '#15803D';

  // Per-metric mode when a metric-click handler is provided. The outer is a
  // <div> so we can nest per-metric <button>s inside (HTML forbids nested
  // buttons). Legacy mode keeps the whole card as one button for the old
  // onClick contract used by Districts/Divisions.
  const perMetric = Boolean(onMetricClick);
  const anyActive = active || activeMetric !== null;

  const commonWrap = cn(
    'group relative flex flex-col items-start rounded-lg border p-4 text-left shadow-sm transition-all',
    anyActive
      ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white'
      : 'border-[#E5E7EB] bg-white hover:-translate-y-0.5 hover:shadow-md',
  );

  const inner = (
    <>
      <div
        className={cn(
          'text-[13px] font-bold',
          anyActive ? 'text-white' : 'text-[#111827]',
        )}
      >
        {name}
      </div>
      {/* Big count == "Projects" metric per spec §1/§2. Clickable when
          onMetricClick is provided; falls back to legacy plain text. */}
      {perMetric ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMetricClick!('total');
          }}
          aria-pressed={activeMetric === 'total'}
          title="View all projects"
          className={cn(
            'mt-1 rounded-md text-[30px] font-extrabold leading-none tabular-nums',
            'hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#1E3A5F]',
            activeMetric === 'total' ? 'underline decoration-white/70 decoration-2 underline-offset-4' : '',
          )}
          style={{ color: anyActive ? '#93C5FD' : color }}
        >
          {total}
        </button>
      ) : (
        <div
          className="mt-1 text-[30px] font-extrabold leading-none tabular-nums"
          style={{ color: anyActive ? '#93C5FD' : color }}
        >
          {total}
        </div>
      )}
      <div
        className={cn(
          'mb-2 text-[11px]',
          anyActive ? 'text-[#93C5FD]' : 'text-[#9CA3AF]',
        )}
      >
        projects
      </div>

      {total > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          {completed > 0 ? (
            <Pip
              active={anyActive}
              tone="success"
              onClick={
                onMetricClick
                  ? () => onMetricClick('completed')
                  : undefined
              }
              highlighted={activeMetric === 'completed'}
              title="View completed projects"
            >
              ✓ {completed}
            </Pip>
          ) : null}
          {inProgress > 0 ? (
            <Pip
              active={anyActive}
              tone="info"
              onClick={
                onMetricClick
                  ? () => onMetricClick('inProgress')
                  : undefined
              }
              highlighted={activeMetric === 'inProgress'}
              title="View in-progress projects"
            >
              ⟳ {inProgress}
            </Pip>
          ) : null}
          {delayed > 0 ? (
            <Pip
              active={anyActive}
              tone="danger"
              onClick={
                onMetricClick
                  ? () => onMetricClick('delayed')
                  : undefined
              }
              highlighted={activeMetric === 'delayed'}
              title="View delayed projects"
            >
              ! {delayed}
            </Pip>
          ) : null}
        </div>
      ) : null}

      {extraStat ? (
        <div
          className={cn(
            'mt-2 text-[10.5px] font-semibold uppercase tracking-wider',
            anyActive ? 'text-[#93C5FD]' : 'text-[#6B7280]',
          )}
        >
          {extraStat.label}:{' '}
          <span className={anyActive ? 'text-white' : 'text-[#111827]'}>{extraStat.value}</span>
        </div>
      ) : null}

      {money ? (
        <div
          className={cn(
            'mt-3 w-full space-y-1.5 border-t pt-2 text-[10.5px]',
            anyActive ? 'border-white/30' : 'border-[#F3F4F6]',
          )}
        >
          <div className="flex items-center justify-between">
            <span
              className={cn(
                'font-bold uppercase tracking-wider',
                anyActive ? 'text-[#93C5FD]' : 'text-[#6B7280]',
              )}
            >
              Alloted
            </span>
            <span
              className={cn(
                'font-bold tabular-nums',
                anyActive ? 'text-white' : 'text-[#111827]',
              )}
            >
              {fmtCr(money.allotedCr)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span
              className={cn(
                'font-bold uppercase tracking-wider',
                anyActive ? 'text-[#93C5FD]' : 'text-[#6B7280]',
              )}
            >
              Spent
            </span>
            <span
              className={cn(
                'font-bold tabular-nums',
                anyActive ? 'text-white' : 'text-[#15803D]',
              )}
            >
              {fmtCr(money.spentCr)}
            </span>
          </div>
          {utilPct !== null ? (
            <div className="pt-0.5">
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'font-bold uppercase tracking-wider',
                    anyActive ? 'text-[#93C5FD]' : 'text-[#6B7280]',
                  )}
                >
                  Utilised
                </span>
                <span
                  className="font-extrabold tabular-nums"
                  style={{ color: anyActive ? '#FCA5A5' : utilColor }}
                >
                  {utilPct.toFixed(1)}%
                </span>
              </div>
              <div
                className={cn(
                  'mt-1 h-1.5 w-full overflow-hidden rounded-full',
                  anyActive ? 'bg-white/20' : 'bg-[#F3F4F6]',
                )}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, utilPct)}%`,
                    backgroundColor: anyActive ? '#93C5FD' : utilColor,
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );

  if (perMetric) {
    return <div className={commonWrap}>{inner}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={commonWrap}
    >
      {inner}
    </button>
  );
}

function Pip({
  active,
  tone,
  children,
  onClick,
  highlighted,
  title,
}: {
  active: boolean;
  tone: 'success' | 'info' | 'danger';
  children: React.ReactNode;
  onClick?: (() => void) | undefined;
  highlighted?: boolean | undefined;
  title?: string | undefined;
}): JSX.Element {
  const styles: Record<typeof tone, { bg: string; text: string; activeBg: string; activeText: string }> = {
    success: {
      bg: 'bg-[#DCFCE7]',
      text: 'text-[#15803D]',
      activeBg: 'bg-white/15',
      activeText: 'text-white',
    },
    info: {
      bg: 'bg-[#DBEAFE]',
      text: 'text-[#1D4ED8]',
      activeBg: 'bg-white/15',
      activeText: 'text-white',
    },
    danger: {
      bg: 'bg-[#FEE2E2]',
      text: 'text-[#B91C1C]',
      activeBg: 'bg-[#EF4444]/30',
      activeText: 'text-[#FCA5A5]',
    },
  };
  const s = styles[tone];
  const baseClass = cn(
    'rounded-full px-2 py-0.5 text-[10px] font-bold',
    active ? cn(s.activeBg, s.activeText) : cn(s.bg, s.text),
    highlighted ? 'ring-2 ring-white ring-offset-1 ring-offset-transparent' : '',
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        aria-pressed={Boolean(highlighted)}
        title={title}
        className={cn(baseClass, 'cursor-pointer transition-opacity hover:opacity-80 focus:outline-none')}
      >
        {children}
      </button>
    );
  }
  return <span className={baseClass}>{children}</span>;
}
