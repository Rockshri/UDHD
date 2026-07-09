import { cn } from '../../lib/utils';
import type { MomStatus } from '../../types/api';

const PALETTE: Record<MomStatus, string> = {
  'Action Pending': 'bg-[#FEF3C7] text-[#92400E]',
  'In Progress': 'bg-[#DBEAFE] text-[#1D4ED8]',
  Resolved: 'bg-[#DCFCE7] text-[#15803D]',
  Deferred: 'bg-[#F3F4F6] text-[#6B7280]',
};

export function MoMStatusBadge({ status }: { status: MomStatus }): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
        PALETTE[status] ?? PALETTE['Action Pending'],
      )}
    >
      {status}
    </span>
  );
}
