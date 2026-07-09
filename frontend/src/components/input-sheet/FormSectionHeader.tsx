import type { ReactNode } from 'react';

export interface FormSectionHeaderProps {
  num: string;
  title: string;
  sub?: string;
  right?: ReactNode;
}

export function FormSectionHeader({
  num,
  title,
  sub,
  right,
}: FormSectionHeaderProps): JSX.Element {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#E5E7EB] pb-3">
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-[#1E3A5F] text-[13px] font-extrabold text-white">
          {num}
        </div>
        <div>
          <div className="text-sm font-bold text-[#111827]">{title}</div>
          {sub ? <div className="mt-0.5 text-[11px] text-[#6B7280]">{sub}</div> : null}
        </div>
      </div>
      {right}
    </div>
  );
}

export interface FieldGroupProps {
  label: string;
  children: ReactNode;
}

export function FieldGroup({ label, children }: FieldGroupProps): JSX.Element {
  return (
    <div className="mb-4">
      <div className="mb-2.5 border-b border-[#F3F4F6] pb-1 text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">
        ▌ {label}
      </div>
      {children}
    </div>
  );
}
