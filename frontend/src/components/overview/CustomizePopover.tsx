import { useEffect, useMemo, useRef, useState } from 'react';
import { Settings2 } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import {
  OVERVIEW_WIDGETS, type OverviewVisibility, type OverviewWidgetDef,
} from './customization';

interface Props {
  visibility: OverviewVisibility;
}

/**
 * Popover trigger + panel that lets the user hide/show any Overview
 * widget. State lives in the parent (via `useOverviewVisibility`) so the
 * page can conditionally render sections without re-fetching KPIs.
 */
export function CustomizePopover({ visibility }: Props): JSX.Element {
  const [open, setOpen] = useState(false);
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

  const groups = useMemo(() => {
    const map = new Map<OverviewWidgetDef['group'], OverviewWidgetDef[]>();
    for (const w of OVERVIEW_WIDGETS) {
      const arr = map.get(w.group) ?? [];
      arr.push(w);
      map.set(w.group, arr);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Settings2 size={14} aria-hidden />
        Customize
        {visibility.hiddenCount > 0 ? (
          <span className="ml-1 rounded-full bg-[#1E3A5F] px-1.5 py-0.5 text-[10px] font-bold text-white">
            {visibility.hiddenCount} hidden
          </span>
        ) : null}
      </Button>

      {open ? (
        <div
          role="dialog"
          aria-label="Customize Overview widgets"
          className={cn(
            'absolute right-0 z-30 mt-1 w-[320px] max-h-[70vh] overflow-y-auto',
            'rounded-md border border-[#E5E7EB] bg-white p-3 shadow-lg',
          )}
        >
          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
              Show / hide widgets
            </span>
            <button
              type="button"
              onClick={visibility.showAll}
              disabled={visibility.hiddenCount === 0}
              className="text-[11px] font-semibold text-[#1D4ED8] hover:underline disabled:cursor-not-allowed disabled:text-[#9CA3AF] disabled:no-underline"
            >
              Show all
            </button>
          </div>

          <div className="space-y-3">
            {groups.map(([group, widgets]) => (
              <fieldset key={group} className="border-t border-[#F3F4F6] pt-2">
                <legend className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-[#374151]">
                  {group}
                </legend>
                <div className="space-y-1">
                  {widgets.map((w) => (
                    <label
                      key={w.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-[13px] text-[#111827] hover:bg-[#F9FAFB]"
                    >
                      <input
                        type="checkbox"
                        checked={visibility.isVisible(w.id)}
                        onChange={(e) => visibility.setVisible(w.id, e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-[#D1D5DB] text-[#1E3A5F] focus:ring-[#1E3A5F]"
                      />
                      {w.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
