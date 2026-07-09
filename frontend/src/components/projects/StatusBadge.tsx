import { cn } from '../../lib/utils';

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'In Progress': { bg: 'bg-[#DBEAFE]', text: 'text-[#1D4ED8]', border: 'border-[#93C5FD]' },
  Completed: { bg: 'bg-[#DCFCE7]', text: 'text-[#15803D]', border: 'border-[#86EFAC]' },
  'Not Started': { bg: 'bg-[#FED7AA]', text: 'text-[#C2410C]', border: 'border-[#FDBA74]' },
  Delayed: { bg: 'bg-[#EDE9FE]', text: 'text-[#6D28D9]', border: 'border-[#C4B5FD]' },
  'On Hold': { bg: 'bg-[#F3F4F6]', text: 'text-[#374151]', border: 'border-[#D1D5DB]' },
};

export function StatusBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}): JSX.Element {
  const s = status ?? 'Not Started';
  const styles = STATUS_STYLES[s] ?? STATUS_STYLES['On Hold']!;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider',
        styles.bg,
        styles.text,
        styles.border,
        className,
      )}
    >
      {s}
    </span>
  );
}
