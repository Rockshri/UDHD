import { daysBetween } from '../../lib/formatters';

export function PbgAlertCell({
  pbgExpiryDate,
}: {
  pbgExpiryDate: string | null | undefined;
}): JSX.Element {
  if (!pbgExpiryDate) {
    return <span className="text-[#D1D5DB]">—</span>;
  }
  const days = daysBetween(new Date(), pbgExpiryDate);
  if (days < 0 || days > 30) {
    return <span className="text-[#D1D5DB]">—</span>;
  }
  const color = days <= 7 ? '#DC2626' : days <= 15 ? '#F97316' : '#EAB308';
  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-[10.5px] font-bold tabular-nums text-white whitespace-nowrap"
      style={{ backgroundColor: color }}
    >
      {days === 0 ? 'Expires TODAY' : `Expiring in ${days}d`}
    </span>
  );
}
