import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
  {
    variants: {
      variant: {
        default: 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]',
        success: 'bg-[#DCFCE7] text-[#15803D] border border-[#86EFAC]',
        warning: 'bg-[#FEF9C3] text-[#92400E] border border-[#FDE68A]',
        danger: 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FCA5A5]',
        neutral: 'bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps): JSX.Element {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
