import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useLogoutMutation } from '../../app/api/authApi';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  openMdBriefing,
  selectCurrentUser,
} from '../../features/auth/authSlice';
import { cn } from '../../lib/utils';
import { RoleGate } from '../auth/RoleGate';
import { BuidcoLogo } from './BuidcoLogo';
import { KpiGuideDrawer } from './KpiGuideDrawer';
import { NavClock } from './NavClock';

/**
 * The 10 primary-nav items moved into the left sidebar per Read.md §1.
 * TopNav now only carries the utility pills (Input Sheet / MoM / O&M),
 * MD-only chips (Audit Trail / Users / MD Briefing), KPI Guide, clock,
 * and user pill — per user's chosen scoping.
 */
interface NavItem {
  to: string;
  label: string;
  icon?: string;
  end?: boolean;
}

const UTILITY_NAV_BEFORE_MOM: NavItem[] = [
  { to: '/input-sheet', label: 'Input Sheet', icon: '📋' },
];
const UTILITY_NAV_MOM_ONWARDS: NavItem[] = [
  { to: '/mom', label: 'MoM', icon: '📅' },
  { to: '/om', label: 'O&M', icon: '🔧' },
];

const utilityLinkClass = ({ isActive }: { isActive: boolean }): string =>
  cn(
    'inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2.5 py-1.5 text-[11.5px] transition-colors border',
    isActive
      ? 'border-transparent bg-[#1E3A5F] font-bold text-white'
      : 'border-[#E5E7EB] bg-white font-medium text-[#374151] hover:bg-[#F9FAFB]',
  );

interface TopNavProps {
  /** Opens the mobile sidebar drawer (< lg only). */
  onOpenMobileNav: () => void;
}

export function TopNav({ onOpenMobileNav }: TopNavProps): JSX.Element {
  const user = useAppSelector(selectCurrentUser);
  const dispatch = useAppDispatch();
  const [logout, { isLoading: loggingOut }] = useLogoutMutation();
  const navigate = useNavigate();
  const [kpiOpen, setKpiOpen] = useState(false);

  const onSignOut = async (): Promise<void> => {
    try {
      await logout().unwrap();
    } catch {
      /* clearCredentials still fires from the mutation's onQueryStarted finally. */
    }
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[#E5E7EB] bg-white shadow-[0_1px_5px_rgba(0,0,0,0.07)]">
      {/* Row 1 — hamburger (mobile) · brand · utility tabs · audit · user pill */}
      <div className="mx-auto flex h-[50px] items-center gap-2 px-4">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="rounded-md p-1.5 text-[#374151] hover:bg-[#F3F4F6] lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <div className="flex flex-shrink-0 items-center gap-2 border-r border-[#E5E7EB] pr-3">
          <BuidcoLogo size={32} />
          <div>
            <div className="text-[13px] font-extrabold leading-tight tracking-wide text-[#111827]">
              BUIDCO
            </div>
            <div className="text-[8px] uppercase tracking-[0.06em] text-[#6B7280]">
              Project Monitoring System
            </div>
          </div>
        </div>

        <nav className="ml-auto flex flex-shrink-0 items-center gap-1.5" aria-label="Utility navigation">
          {UTILITY_NAV_BEFORE_MOM.map((item) => (
            <NavLink key={item.to} to={item.to} className={utilityLinkClass}>
              {item.icon && <span className="text-[13px]" aria-hidden>{item.icon}</span>}
              {item.label}
            </NavLink>
          ))}
          <RoleGate allow={['MD']}>
            <button
              type="button"
              onClick={() => dispatch(openMdBriefing())}
              title="Open MD Portfolio Briefing"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded border border-[#1E3A5F] bg-[#1E3A5F] px-2.5 py-1.5 text-[11.5px] font-bold text-white transition-colors hover:bg-[#162B47]"
            >
              <span aria-hidden>📊</span> MD Portfolio Briefing
            </button>
          </RoleGate>
          {UTILITY_NAV_MOM_ONWARDS.map((item) => (
            <NavLink key={item.to} to={item.to} className={utilityLinkClass}>
              {item.icon && <span className="text-[13px]" aria-hidden>{item.icon}</span>}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex flex-shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setKpiOpen(true)}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB]',
            )}
            aria-label="Open KPI reference guide"
          >
            <span aria-hidden>❓</span> KPI Guide
          </button>
          <RoleGate allow={['MD']}>
            <NavLink to="/audit" className={utilityLinkClass}>
              <span aria-hidden>🕒</span> Audit Trail
            </NavLink>
          </RoleGate>
          <RoleGate allow={['MD', 'Admin']}>
            <NavLink to="/users" className={utilityLinkClass}>
              <span aria-hidden>👥</span> Users
            </NavLink>
          </RoleGate>

          <NavClock />

          <div className="flex flex-col overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
            <div className="flex items-center justify-center gap-1.5 border-b border-[#E5E7EB] bg-[#F9FAFB] px-3 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#111827]">
                {user?.role ?? '—'}
              </span>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              disabled={loggingOut}
              className="cursor-pointer bg-white px-3 py-0.5 text-[10.5px] font-medium text-[#6B7280] transition-colors hover:bg-[#FEF2F2] hover:text-[#B91C1C] disabled:opacity-60"
            >
              {loggingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </div>

      {/* Primary navigation lives in the left sidebar (Read.md §1). */}

      <KpiGuideDrawer open={kpiOpen} onClose={() => setKpiOpen(false)} />
    </header>
  );
}
