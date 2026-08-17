import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CloudRain,
  FileEdit,
  FileText,
  FolderTree,
  Gavel,
  HelpCircle,
  History,
  LayoutDashboard,
  Map,
  Moon,
  Sun,
  Tag,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { openMdBriefing, selectCurrentUser } from '../../features/auth/authSlice';
import { useTheme } from '../../hooks/useTheme';
import { cn } from '../../lib/utils';
import { RoleGate } from '../auth/RoleGate';
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
  /** Opens the Tender Dashboard modal (separate group below the primary nav). */
  onOpenTenderDashboard: () => void;
  /** Opens the KPI Guide drawer (mirrors the TopNav pill for mobile users). */
  onOpenKpiGuide: () => void;
}

export function Sidebar({
  collapsed, onToggleCollapsed, mobileOpen, onCloseMobile, onOpenTenderDashboard, onOpenKpiGuide,
}: Props): JSX.Element {
  const currentUser = useAppSelector(selectCurrentUser);
  const dispatch = useAppDispatch();
  const theme = useTheme();
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

          {/*
            Tender Dashboard sits in its own group below Pre-Monsoon
            Preparation (Tender_Dashboard.md §3). It opens a modal instead of
            navigating, so it's a button rather than a NavLink. The <hr>
            visually separates it from the primary nav.
          */}
          <hr
            aria-hidden
            className={cn(
              'mx-2 my-2 border-t border-[#E5E7EB]',
              collapsed ? 'lg:mx-1.5' : '',
            )}
          />
          <ul className="flex flex-col gap-0.5 px-2">
            <li>
              <SidebarButton
                label="Tender Dashboard"
                Icon={Gavel}
                collapsed={collapsed}
                onClick={() => {
                  onCloseMobile();
                  onOpenTenderDashboard();
                }}
              />
            </li>
            {/*
              User Management — MD/Admin only. Sits at the bottom of the
              sidebar so admin actions are grouped together. Also mirrored
              in the mobile Tools section below for parity, but that
              duplicate is hidden on `lg` since this entry covers it.
            */}
            <RoleGate allow={['MD', 'Admin']}>
              <li>
                <SidebarLink
                  to="/users"
                  label="User Management"
                  Icon={Users}
                  collapsed={collapsed}
                  end={false}
                  onNavigate={onCloseMobile}
                />
              </li>
            </RoleGate>
          </ul>

          {/*
            Mobile-only utility section (< lg). Mirrors the TopNav utility
            pills so tablet/phone users still have access to Input Sheet,
            MoM, O&M, MD Briefing, KPI Guide, Audit Trail, and Users —
            without those pills overflowing the 50px header on small screens.
          */}
          <div className="lg:hidden">
            <hr aria-hidden className="mx-2 my-2 border-t border-[#E5E7EB]" />
            <p className="px-4 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
              Tools
            </p>
            <ul className="flex flex-col gap-0.5 px-2">
              <li>
                <SidebarLink
                  to="/input-sheet"
                  label="Input Sheet"
                  Icon={FileText}
                  collapsed={false}
                  end={false}
                  onNavigate={onCloseMobile}
                />
              </li>
              <RoleGate allow={['MD']}>
                <li>
                  <SidebarButton
                    label="MD Portfolio Briefing"
                    Icon={BarChart3}
                    collapsed={false}
                    onClick={() => {
                      onCloseMobile();
                      dispatch(openMdBriefing());
                    }}
                  />
                </li>
              </RoleGate>
              <li>
                <SidebarLink
                  to="/mom"
                  label="MoM"
                  Icon={Calendar}
                  collapsed={false}
                  end={false}
                  onNavigate={onCloseMobile}
                />
              </li>
              <li>
                <SidebarLink
                  to="/om"
                  label="O&M"
                  Icon={Wrench}
                  collapsed={false}
                  end={false}
                  onNavigate={onCloseMobile}
                />
              </li>
              <li>
                <SidebarButton
                  label="KPI Guide"
                  Icon={HelpCircle}
                  collapsed={false}
                  onClick={() => {
                    onCloseMobile();
                    onOpenKpiGuide();
                  }}
                />
              </li>
              <RoleGate allow={['MD']}>
                <li>
                  <SidebarLink
                    to="/audit"
                    label="Audit Trail"
                    Icon={History}
                    collapsed={false}
                    end={false}
                    onNavigate={onCloseMobile}
                  />
                </li>
              </RoleGate>
              {/*
                User Management was here but is now a first-class item
                above (in the always-visible section), so this duplicate
                mobile Tools entry is removed to prevent showing it twice.
              */}
            </ul>
          </div>
        </nav>

        {/* ── Theme toggle — pinned to the very bottom of the sidebar ── */}
        <div
          className={cn(
            'shrink-0 border-t border-[#E5E7EB] px-2 py-2',
            collapsed ? 'lg:px-1.5' : '',
          )}
        >
          <ThemeToggle
            applied={theme.applied}
            onToggle={theme.toggle}
            collapsed={collapsed}
          />
        </div>
      </aside>
    </>
  );
}

/**
 * Sun/moon toggle. Reflects the currently-applied theme (so a 'system'
 * preference still shows the correct icon). Full-width label when the
 * sidebar is expanded, icon-only when collapsed.
 */
function ThemeToggle({
  applied, onToggle, collapsed,
}: {
  applied: 'light' | 'dark';
  onToggle: () => void;
  collapsed: boolean;
}): JSX.Element {
  const isDark = applied === 'dark';
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? 'Light mode' : 'Dark mode';
  return (
    <button
      type="button"
      onClick={onToggle}
      title={collapsed ? label : undefined}
      aria-label={label}
      className={cn(
        'group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[12.5px] font-medium text-[#4B5563] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]',
        collapsed && 'lg:justify-center lg:px-1.5',
      )}
    >
      <Icon
        size={17}
        className="shrink-0 text-[#6B7280] group-hover:text-[#374151]"
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
    </button>
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

/**
 * Same visual grammar as SidebarLink but for actions that open a modal
 * rather than navigating. No `isActive` state — the modal manages its own
 * open/closed lifecycle.
 */
function SidebarButton({
  label, Icon, collapsed, onClick,
}: {
  label: string;
  Icon: typeof LayoutDashboard;
  collapsed: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        'group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[12.5px] font-medium text-[#4B5563] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]',
        collapsed && 'lg:justify-center lg:px-1.5',
      )}
    >
      <Icon
        size={17}
        className="shrink-0 text-[#6B7280] group-hover:text-[#374151]"
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
    </button>
  );
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

