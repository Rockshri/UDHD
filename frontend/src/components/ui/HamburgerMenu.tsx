import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Reusable "kebab / hamburger" dropdown menu with optional sub-menus.
 *
 * - Click the trigger to open; click outside or press Escape to close
 * - Menu items can be plain actions, dividers, or nested sub-menus
 * - Sub-menu opens on the OPPOSITE side of the parent's alignment so
 *   the submenu never clips off the viewport edge
 * - Fully keyboard-accessible via aria-haspopup + aria-expanded
 *
 * ```tsx
 * <HamburgerMenu
 *   align="end"
 *   items={[
 *     { type: 'action', label: 'Import…', onClick: handleImport },
 *     { type: 'divider' },
 *     { type: 'submenu', label: 'Export', items: [
 *       { type: 'action', label: 'Excel', onClick: exportXlsx },
 *     ] },
 *   ]}
 * />
 * ```
 */

export type MenuItem =
  | { type: 'action'; label: string; onClick: () => void; icon?: React.ReactNode; disabled?: boolean }
  | { type: 'submenu'; label: string; items: Array<Extract<MenuItem, { type: 'action' }>>; icon?: React.ReactNode }
  | { type: 'divider' };

export interface HamburgerMenuProps {
  items: MenuItem[];
  /** 'end' = right-aligned to trigger (default); 'start' = left-aligned. */
  align?: 'start' | 'end';
  /** Optional class for the trigger button. */
  triggerClass?: string;
  /** aria-label + title on the trigger. */
  ariaLabel?: string;
}

export function HamburgerMenu({
  items, align = 'end', triggerClass, ariaLabel = 'Open menu',
}: HamburgerMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const closeAll = (): void => { setOpen(false); setOpenSubmenu(null); };

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) closeAll();
    };
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') closeAll(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={ariaLabel}
        aria-label={ariaLabel}
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#374151] transition-colors hover:bg-[#F9FAFB]',
          open && 'bg-[#F3F4F6] shadow-sm',
          triggerClass,
        )}
      >
        <MoreVertical size={16} aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className={cn(
            'absolute top-full z-40 mt-1 min-w-[220px] overflow-hidden rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-xl',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item, idx) => (
            <MenuRow
              key={idx}
              item={item}
              idx={idx}
              align={align}
              isSubmenuOpen={openSubmenu === idx}
              onToggleSubmenu={() => setOpenSubmenu(openSubmenu === idx ? null : idx)}
              onClose={closeAll}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ─── Internal ─────────────────────────────────────────────────────────────

interface MenuRowProps {
  item: MenuItem;
  idx: number;
  align: 'start' | 'end';
  isSubmenuOpen: boolean;
  onToggleSubmenu: () => void;
  onClose: () => void;
}

function MenuRow({ item, align, isSubmenuOpen, onToggleSubmenu, onClose }: MenuRowProps): JSX.Element {
  if (item.type === 'divider') {
    return <hr aria-hidden className="my-1 border-t border-[#F3F4F6]" />;
  }
  if (item.type === 'submenu') {
    // Submenu opens away from the parent's dock side so it doesn't clip.
    const isRightAligned = align === 'end';
    return (
      <div className="relative">
        <button
          type="button"
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={isSubmenuOpen}
          onClick={onToggleSubmenu}
          className={cn(
            'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12.5px] transition-colors',
            isSubmenuOpen ? 'bg-[#F3F4F6]' : 'hover:bg-[#F9FAFB]',
          )}
        >
          <span className="flex items-center gap-2 text-[#111827]">
            {isRightAligned ? <ChevronLeft size={14} aria-hidden className="text-[#6B7280]" /> : null}
            {item.icon}
            {item.label}
          </span>
          {!isRightAligned ? <ChevronRight size={14} aria-hidden className="text-[#6B7280]" /> : null}
        </button>
        {isSubmenuOpen ? (
          <div
            role="menu"
            aria-label={item.label}
            className={cn(
              'absolute top-0 z-50 min-w-[180px] rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-xl',
              isRightAligned ? 'right-full mr-1' : 'left-full ml-1',
            )}
          >
            {item.items.map((sub, si) => (
              <ActionRow key={si} item={sub} onClose={onClose} />
            ))}
          </div>
        ) : null}
      </div>
    );
  }
  return <ActionRow item={item} onClose={onClose} />;
}

function ActionRow({
  item, onClose,
}: {
  item: Extract<MenuItem, { type: 'action' }>;
  onClose: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={item.disabled}
      onClick={() => { if (!item.disabled) { item.onClick(); onClose(); } }}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-[#111827] transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {item.icon}
      {item.label}
    </button>
  );
}
