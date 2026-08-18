import { useEffect, useMemo, useRef, useState } from 'react';
import { Filter } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Numeric column filter (operator + threshold) used on money columns like
 * the AA Amount column in the Projects Register. Sibling to
 * ColumnFilterButton (which is a discrete-value picker) — same funnel-icon
 * visual language but with a different popover shape.
 *
 * Input is entered in RUPEES (matches how humans quote AA amounts) and
 * converted to CRORES internally so it matches the column's stored value
 * (numeric(12,2) in crores). Live "= X Cr" preview keeps the unit
 * conversion transparent.
 */

export type NumericComparisonOp = '>' | '>=' | '=' | '<=' | '<';

export interface NumericFilter {
  op: NumericComparisonOp;
  /** Threshold in the same unit as the target value (crores, for AA). */
  valueInTargetUnit: number;
}

interface Props {
  label: string;
  filter: NumericFilter | null;
  onChange: (next: NumericFilter | null) => void;
  align?: 'start' | 'end';
}

const OPS: Array<{ id: NumericComparisonOp; label: string; word: string }> = [
  { id: '>',  label: '>',   word: 'Greater than' },
  { id: '>=', label: '≥',   word: 'Greater than or equal to' },
  { id: '=',  label: '=',   word: 'Equal to' },
  { id: '<=', label: '≤',   word: 'Less than or equal to' },
  { id: '<',  label: '<',   word: 'Less than' },
];

/** Indian grouping formatter (2,3,3 style) used for the input display. */
const IN_INT = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const IN_CR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

/** Parse a user-typed amount → integer rupees. Strips commas / spaces /
 *  ₹ / non-digit characters. Empty or non-numeric → null. */
function parseRupees(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.]/g, '');
  if (cleaned === '' || cleaned === '.') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

export function NumericFilterButton({
  label, filter, onChange, align = 'start',
}: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Local draft — only committed to the parent on Apply, so half-typed
  // input doesn't filter the table on every keystroke.
  const [draftOp, setDraftOp] = useState<NumericComparisonOp>(filter?.op ?? '>');
  const [draftRupees, setDraftRupees] = useState<string>(() =>
    filter ? IN_INT.format(Math.round(filter.valueInTargetUnit * 1e7)) : '',
  );

  // Hydrate draft from the committed filter whenever the popover opens.
  useEffect(() => {
    if (open) {
      setDraftOp(filter?.op ?? '>');
      setDraftRupees(filter ? IN_INT.format(Math.round(filter.valueInTargetUnit * 1e7)) : '');
    }
  }, [open, filter]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const active = filter !== null;
  const parsedRupees = useMemo(() => parseRupees(draftRupees), [draftRupees]);
  const previewCr = parsedRupees !== null ? parsedRupees / 1e7 : null;

  const apply = (): void => {
    if (parsedRupees === null) return;
    onChange({ op: draftOp, valueInTargetUnit: parsedRupees / 1e7 });
    setOpen(false);
  };

  const clear = (): void => {
    onChange(null);
    setOpen(false);
  };

  const activeLabelShort = filter
    ? `${filter.op} ${IN_CR.format(filter.valueInTargetUnit)} Cr`
    : null;

  return (
    <span ref={rootRef} className="relative inline-flex align-middle">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={active ? `Filter on ${label} (${activeLabelShort})` : `Filter ${label}`}
        title={active ? `${label} ${activeLabelShort}` : `Filter ${label}`}
        className={cn(
          'ml-1 inline-flex h-4 w-4 items-center justify-center rounded transition-colors',
          active
            ? 'bg-[#1E3A5F] text-white hover:bg-[#152a48]'
            : 'text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151]',
        )}
      >
        <Filter size={10} strokeWidth={2.5} aria-hidden />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={`Filter ${label}`}
          className={cn(
            'absolute top-full z-50 mt-1 w-[280px] overflow-hidden rounded-md border border-[#E5E7EB] bg-white shadow-xl',
            align === 'end' ? 'right-0' : 'left-0',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-[#F3F4F6] px-3 py-2 text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">
            {label} — filter by amount
          </div>

          <div className="space-y-2 px-3 py-2">
            <label className="block">
              <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-[#374151]">
                Condition
              </span>
              <select
                value={draftOp}
                onChange={(e) => setDraftOp(e.target.value as NumericComparisonOp)}
                className="h-8 w-full rounded border border-[#D1D5DB] px-2 text-[12px] focus:border-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
              >
                {OPS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}  {o.word}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-[#374151]">
                Amount (₹)
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-[#6B7280]">₹</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={draftRupees}
                  onChange={(e) => {
                    // Re-format on the fly with Indian grouping so users see
                    // 10,00,00,000 while typing.
                    const raw = e.target.value;
                    const parsed = parseRupees(raw);
                    setDraftRupees(parsed !== null ? IN_INT.format(parsed) : raw.replace(/[^\d.]/g, ''));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && parsedRupees !== null) {
                      e.preventDefault();
                      apply();
                    }
                  }}
                  placeholder="e.g. 10,00,00,000"
                  className="h-8 w-full rounded border border-[#D1D5DB] px-2 text-[12px] tabular-nums focus:border-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                  autoFocus
                />
              </div>
              <p className="mt-1 text-[10.5px] text-[#6B7280]">
                {previewCr !== null
                  ? <>= <span className="font-semibold tabular-nums text-[#111827]">{IN_CR.format(previewCr)} Cr</span></>
                  : 'Enter an amount in rupees'}
              </p>
            </label>
          </div>

          <div className="flex items-center justify-between border-t border-[#F3F4F6] px-3 py-2">
            <button
              type="button"
              onClick={clear}
              disabled={!active}
              className="text-[11px] font-semibold text-[#B91C1C] hover:underline disabled:cursor-not-allowed disabled:text-[#9CA3AF]"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={parsedRupees === null}
              className="rounded bg-[#1E3A5F] px-3 py-1 text-[11.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </span>
  );
}

/** Predicate for a numeric filter — returns true if the row's value
 *  matches the filter. Nulls never match (row is excluded when a filter
 *  is active but the row has no value). */
export function matchesNumericFilter(
  filter: NumericFilter | null,
  rowValue: number | null | undefined,
): boolean {
  if (!filter) return true;
  if (rowValue === null || rowValue === undefined) return false;
  switch (filter.op) {
    case '>':  return rowValue >  filter.valueInTargetUnit;
    case '>=': return rowValue >= filter.valueInTargetUnit;
    case '=':  return rowValue === filter.valueInTargetUnit;
    case '<=': return rowValue <= filter.valueInTargetUnit;
    case '<':  return rowValue <  filter.valueInTargetUnit;
  }
}
