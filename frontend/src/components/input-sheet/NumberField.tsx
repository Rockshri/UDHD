import { cn } from '../../lib/utils';

export interface NumberFieldProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  suffix?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
  min?: number;
  max?: number;
  step?: string;
  className?: string;
}

/**
 * Number field with clean `null ↔ ""` bridge. Empty input yields `null`;
 * any other value that parses as a finite number yields that number.
 */
export function NumberField({
  label,
  value,
  onChange,
  suffix,
  placeholder,
  required = false,
  disabled = false,
  hint,
  min,
  max,
  step = 'any',
  className,
}: NumberFieldProps): JSX.Element {
  const display = value === null || value === undefined ? '' : String(value);

  return (
    <label className={cn('grid gap-1', className)}>
      <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[#374151]">
        {label}
        {required ? <span className="ml-1 text-[#B91C1C]">*</span> : null}
      </span>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          value={display}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') return onChange(null);
            const n = Number(v);
            onChange(Number.isFinite(n) ? n : null);
          }}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          step={step}
          min={min}
          max={max}
          className={cn(
            'h-9 w-full rounded border border-[#D1D5DB] bg-white px-3 py-1.5 text-[13px] tabular-nums text-[#111827]',
            'placeholder:text-[#9CA3AF]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-offset-1',
            'disabled:cursor-not-allowed disabled:bg-[#F9FAFB] disabled:text-[#6B7280]',
            suffix ? 'pr-10' : '',
          )}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#6B7280]">
            {suffix}
          </span>
        ) : null}
      </div>
      {hint ? <span className="text-[10.5px] text-[#6B7280]">{hint}</span> : null}
    </label>
  );
}
