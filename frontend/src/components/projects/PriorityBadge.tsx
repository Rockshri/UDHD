import { cn } from '../../lib/utils';

const PRIORITY_STYLES: Record<string, string> = {
  High: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FCA5A5]',
  Medium: 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]',
  Low: 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]',
  'N/A': 'bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB]',
};

export function PriorityBadge({
  priority,
  className,
}: {
  priority: string | null | undefined;
  className?: string;
}): JSX.Element {
  if (!priority) {
    return <span className="text-[#D1D5DB]">—</span>;
  }
  const styles = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES['N/A']!;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-bold',
        styles,
        className,
      )}
    >
      {priority}
    </span>
  );
}
