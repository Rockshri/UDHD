import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className={cn('animate-pulse rounded bg-[#E5E7EB]', className)}
      aria-hidden="true"
      {...props}
    />
  );
}
