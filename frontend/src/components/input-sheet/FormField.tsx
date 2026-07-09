import type { ChangeEvent, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface FormFieldProps {
  label: string;
  value: string | number | null | undefined;
  onChange?: (value: string) => void;
  type?: 'text' | 'number' | 'date' | 'textarea' | 'select';
  options?: ReadonlyArray<string | { value: string; label: string }>;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
  suffix?: ReactNode;
  className?: string;
  step?: string;
  min?: number;
  max?: number;
  autoFocus?: boolean;
}

/**
 * Labeled form field — mirrors the reference JSX's field styling.
 * Uses uncontrolled `null → ""` bridge so the caller can hold `null` in
 * state and this component still renders an empty input.
 */
export function FormField({
  label,
  value,
  onChange,
  type = 'text',
  options,
  placeholder,
  rows = 3,
  required = false,
  disabled = false,
  hint,
  suffix,
  className,
  step,
  min,
  max,
  autoFocus = false,
}: FormFieldProps): JSX.Element {
  const stringValue = value === null || value === undefined ? '' : String(value);

  const inputBase = cn(
    'w-full rounded border border-[#D1D5DB] bg-white px-3 py-1.5 text-[13px] text-[#111827]',
    'placeholder:text-[#9CA3AF]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-offset-1',
    'disabled:cursor-not-allowed disabled:bg-[#F9FAFB] disabled:text-[#6B7280]',
  );

  const handle = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void => {
    onChange?.(e.target.value);
  };

  return (
    <label className={cn('grid gap-1', className)}>
      <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[#374151]">
        {label}
        {required ? <span className="ml-1 text-[#B91C1C]">*</span> : null}
      </span>
      {type === 'textarea' ? (
        <textarea
          value={stringValue}
          onChange={handle}
          placeholder={placeholder}
          rows={rows}
          required={required}
          disabled={disabled}
          autoFocus={autoFocus}
          className={cn(inputBase, 'min-h-[64px] resize-y')}
        />
      ) : type === 'select' ? (
        <select
          value={stringValue}
          onChange={handle}
          required={required}
          disabled={disabled}
          autoFocus={autoFocus}
          className={cn(inputBase, 'h-9')}
        >
          <option value="">— Select —</option>
          {(options ?? []).map((opt) => {
            const [v, l] = typeof opt === 'string' ? [opt, opt] : [opt.value, opt.label];
            return (
              <option key={v} value={v}>
                {l}
              </option>
            );
          })}
        </select>
      ) : (
        <input
          type={type}
          value={stringValue}
          onChange={handle}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoFocus={autoFocus}
          step={step}
          min={min}
          max={max}
          className={cn(inputBase, 'h-9')}
        />
      )}
      {hint ? <span className="text-[10.5px] text-[#6B7280]">{hint}</span> : null}
      {suffix}
    </label>
  );
}
