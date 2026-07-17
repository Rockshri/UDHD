import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  AlertTriangle,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CloudRain,
  FileEdit,
  FolderTree,
  LayoutDashboard,
  Map,
  MapPin,
  Tag,
  X,
} from 'lucide-react';
import { useAppSelector } from '../../app/hooks';
import { selectCurrentUser } from '../../features/auth/authSlice';
import { cn } from '../../lib/utils';
import type { UserRole } from '../../types/api';

/**
 * Primary navigation (Read.md §1). Order matches the spec exactly; labels
 * kept as the current app spells them per user's answer during scoping.
 */
interface NavItem {
  to: string;
  label: string;
  Icon: typeof LayoutDashboard;
  end?: boolean;
  /** Roles this item is hidden for. Absent = shown to everyone. */
  hideFor?: UserRole[];
}

/**
 * Phase C2 — PDs are pinned to a single division and shouldn't be looking
 * at portfolio-wide District/Division breakdowns. Hidden client-side in
 * the sidebar (spec choice: hide entirely). Backend also filters for
 * defence-in-depth if a PD types the URL manually.
 */
const PRIMARY_NAV: NavItem[] = [
  { to: '/',                    label: 'Overview',           Icon: LayoutDashboard, end: true },
  { to: '/sectors',             label: 'Sectors',            Icon: Tag },
  { to: '/schemes',             label: 'Schemes',            Icon: FolderTree },
  { to: '/projects',            label: 'Projects',           Icon: ClipboardList },
  { to: '/districts',           label: 'Districts',          Icon: MapPin, hideFor: ['PD'] },
  { to: '/divisions',           label: 'Divisions',          Icon: Map,    hideFor: ['PD'] },
  { to: '/cos-eot',             label: 'CoS / EoT',          Icon: FileEdit },
  { to: '/management-actions',  label: 'Management Action',  Icon: CheckSquare },
  { to: '/gaps',                label: 'Outstanding Gaps',   Icon: AlertTriangle },
  { to: '/pre-monsoon',         label: 'Pre-Monsoon Prep',   Icon: CloudRain },
];

interface Props {
  /** Desktop collapsed state (persists to localStorage). */
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Mobile drawer open state (transient). */
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  collapsed, onToggleCollapsed, mobileOpen, onCloseMobile,
}: Props): JSX.Element {
  const currentUser = useAppSelector(selectCurrentUser);
  const role = currentUser?.role;
  const visibleNav = PRIMARY_NAV.filter(
    (item) => !item.hideFor || !role || !item.hideFor.includes(role),
  );

  // Close mobile drawer on Escape (matches modal convention).
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCloseMobile();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mobileOpen, onCloseMobile]);

  return (
    <>
      {/* Backdrop — mobile drawer only */}
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      ) : null}

      <aside
        aria-label="Primary navigation"
        className={cn(
          // Base — desktop persistent, mobile fixed drawer
          'sticky top-[50px] z-40 flex h-[calc(100vh-50px)] shrink-0 flex-col border-r border-[#E5E7EB] bg-white transition-all duration-200',
          // Collapsed width (desktop) toggles between rail and full
          collapsed ? 'lg:w-[64px]' : 'lg:w-[220px]',
          // Mobile: fixed drawer slides in from left
          'fixed left-0 w-[240px] shadow-2xl',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: no translation regardless
          'lg:sticky lg:translate-x-0 lg:shadow-none',
        )}
      >
        {/* Header — toggle (desktop) or close (mobile) */}
        <div
          className={cn(
            'flex shrink-0 items-center border-b border-[#E5E7EB] px-2 py-2',
            collapsed ? 'lg:justify-center' : 'justify-between',
          )}
        >
          {/* Mobile close */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] lg:hidden"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>

          {/* Desktop expand/collapse toggle */}
          <button
            type="button"
            onClick={onToggleCollapsed}
            className={cn(
              'hidden items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-semibold text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827] lg:inline-flex',
              collapsed ? 'w-9 justify-center' : 'w-full justify-between',
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? (
              <ChevronRight size={16} />
            ) : (
              <>
                <span className="uppercase tracking-wider">Navigation</span>
                <ChevronLeft size={16} />
              </>
            )}
          </button>
        </div>

        {/* Nav list */}
        <nav className="flex-1 overflow-y-auto py-2" aria-label="Primary">
          <ul className="flex flex-col gap-0.5 px-2">
            {visibleNav.map((item) => (
              <li key={item.to}>
                <SidebarLink
                  to={item.to}
                  label={item.label}
                  Icon={item.Icon}
                  collapsed={collapsed}
                  end={item.end ?? false}
                  onNavigate={onCloseMobile}
                />
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
}

interface SidebarLinkProps {
  to: string;
  label: string;
  Icon: typeof LayoutDashboard;
  collapsed: boolean;
  end: boolean;
  onNavigate: () => void;
}

function SidebarLink({
  to, label, Icon, collapsed, end, onNavigate,
}: SidebarLinkProps): JSX.Element {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[12.5px] font-medium transition-colors',
          collapsed && 'lg:justify-center lg:px-1.5',
          isActive
            ? 'bg-[#1E3A5F] text-white'
            : 'text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#111827]',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={17}
            className={cn(
              'shrink-0 transition-transform',
              isActive ? 'text-white' : 'text-[#6B7280] group-hover:text-[#374151]',
            )}
            aria-hidden
          />
          <span
            className={cn(
              'truncate transition-opacity',
              collapsed ? 'lg:hidden' : 'inline',
            )}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}
