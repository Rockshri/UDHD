import { useEffect, useMemo, useRef, useState } from 'react';
import { Filter } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Excel-style column-filter trigger. Renders a small funnel icon next to
 * a column header; opens a popover with:
 *   - text search over distinct values in the column
 *   - checkable list (multi-select)
 *   - Select all / Clear buttons
 *
 * Controlled by useColumnFilters — pass in the distinct options and the
 * current selection. Filter application happens in the parent.
 */

interface Props {
  label: string;
  options: readonly string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  /** Popover alignment — 'start' = left-aligned with the button, 'end' = right. */
  align?: 'start' | 'end';
}

export function ColumnFilterButton({
  label, options, selected, onChange, align = 'start',
}: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);

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

  const active = selected.size > 0;

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return options;
    return options.filter((o) => o.toLowerCase().includes(term));
  }, [q, options]);

  const toggle = (value: string): void => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  };

  const selectAllVisible = (): void => {
    const next = new Set(selected);
    for (const v of visible) next.add(v);
    onChange(next);
  };

  const clear = (): void => onChange(new Set());

  return (
    <span ref={rootRef} className="relative inline-flex align-middle">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={active ? `Filter on ${label} (${selected.size} active)` : `Filter ${label}`}
        title={active ? `${selected.size} filter${selected.size === 1 ? '' : 's'} on ${label}` : `Filter ${label}`}
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
            'absolute top-full z-50 mt-1 w-[240px] overflow-hidden rounded-md border border-[#E5E7EB] bg-white shadow-xl',
            align === 'end' ? 'right-0' : 'left-0',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-[#F3F4F6] px-2 py-1.5">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${label}…`}
              className="h-7 w-full rounded border border-[#D1D5DB] px-2 text-[12px] focus:border-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
              autoFocus
              // Prevent the parent <th> onClick (if any) from firing.
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="flex items-center justify-between border-b border-[#F3F4F6] px-2 py-1 text-[10.5px]">
            <button
              type="button"
              onClick={selectAllVisible}
              disabled={visible.length === 0}
              className="font-semibold text-[#1D4ED8] hover:underline disabled:cursor-not-allowed disabled:text-[#9CA3AF]"
            >
              Select all{q.trim() ? ' visible' : ''}
            </button>
            <button
              type="button"
              onClick={clear}
              disabled={selected.size === 0}
              className="font-semibold text-[#B91C1C] hover:underline disabled:cursor-not-allowed disabled:text-[#9CA3AF]"
            >
              Clear
            </button>
          </div>
          <ul className="max-h-[240px] overflow-y-auto py-1">
            {visible.length === 0 ? (
              <li className="px-3 py-3 text-center text-[11.5px] text-[#9CA3AF]">
                No matches.
              </li>
            ) : (
              visible.map((value) => (
                <li key={value}>
                  <label className="flex cursor-pointer items-center gap-2 px-2 py-1 text-[12px] text-[#111827] hover:bg-[#F9FAFB]">
                    <input
                      type="checkbox"
                      checked={selected.has(value)}
                      onChange={() => toggle(value)}
                      className="h-3.5 w-3.5 rounded border-[#D1D5DB] text-[#1E3A5F] focus:ring-[#1E3A5F]"
                    />
                    <span className="truncate" title={value}>{value}</span>
                  </label>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </span>
  );
}
