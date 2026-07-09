import { daysBetween } from '../../lib/formatters';

interface Args {
  status: string | null | undefined;
  omApplicable: boolean | null | undefined;
  omStartDate: string | null | undefined;
  omEndDate: string | null | undefined;
  omPeriodMonths: number | null | undefined;
  omStatusOverride: string | null | undefined;
}

function computeEndDate(args: Args): Date | null {
  if (args.omEndDate) return new Date(args.omEndDate);
  if (args.omStartDate && args.omPeriodMonths !== null && args.omPeriodMonths !== undefined) {
    const d = new Date(args.omStartDate);
    d.setMonth(d.getMonth() + Math.round(args.omPeriodMonths));
    return d;
  }
  return null;
}

function computeStatus(args: Args, daysLeft: number | null): string | null {
  if (args.omStatusOverride) return args.omStatusOverride;
  if (daysLeft === null) return null;
  const startDate = args.omStartDate ? new Date(args.omStartDate) : null;
  if (startDate && new Date() < startDate) return 'Not Started';
  if (daysLeft < 0) return 'Expired';
  if (daysLeft <= 30) return 'Expiring Soon';
  return 'Ongoing';
}

const STATUS_COLOR: Record<string, string> = {
  Ongoing: '#15803D',
  'Expiring Soon': '#F97316',
  Expired: '#DC2626',
  'Handed Over to ULB': '#6B7280',
  'Not Started': '#94A3B8',
};

export function OmAlertCell(args: Args): JSX.Element {
  if (args.status !== 'Completed' || !args.omApplicable || !args.omStartDate) {
    return <span className="text-[#D1D5DB]">—</span>;
  }
  const endDate = computeEndDate(args);
  const daysLeft = endDate ? daysBetween(new Date(), endDate) : null;
  const status = computeStatus(args, daysLeft);
  if (!status) return <span className="text-[#D1D5DB]">—</span>;

  const color = STATUS_COLOR[status] ?? '#6B7280';
  const label =
    status === 'Expired' && daysLeft !== null
      ? `Expired ${Math.abs(daysLeft)}d ago`
      : status === 'Expiring Soon' && daysLeft !== null
        ? `${daysLeft}d left`
        : status;

  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-[10.5px] font-bold tabular-nums text-white whitespace-nowrap"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}
