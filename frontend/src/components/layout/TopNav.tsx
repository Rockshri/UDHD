import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useLogoutMutation } from '../../app/api/authApi';
import { useAppSelector } from '../../app/hooks';
import { selectCurrentUser } from '../../features/auth/authSlice';
import { cn } from '../../lib/utils';
import { RoleGate } from '../auth/RoleGate';
import { BuidcoLogo } from './BuidcoLogo';
import { KpiGuideDrawer } from './KpiGuideDrawer';
import { NavClock } from './NavClock';

interface NavItem {
  to: string;
  label: string;
  icon?: string;
  end?: boolean;
}

const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Overview', end: true },
  { to: '/schemes', label: 'Schemes' },
  { to: '/sectors', label: 'Sector' },
  { to: '/projects', label: 'Projects' },
  { to: '/districts', label: 'Districts' },
  { to: '/cos-eot', label: 'CoS / EoT' },
  { to: '/management-actions', label: 'Management Action' },
  { to: '/gaps', label: 'Outstanding Gaps' },
  { to: '/pre-monsoon', label: 'Pre-Monsoon Prep' },
];

const UTILITY_NAV: NavItem[] = [
  { to: '/input-sheet', label: 'Input Sheet', icon: '📋' },
  { to: '/mom', label: 'MoM', icon: '📅' },
  { to: '/om', label: 'O&M', icon: '🔧' },
];

const primaryLinkClass = ({ isActive }: { isActive: boolean }): string =>
  cn(
    'inline-flex items-center gap-1 whitespace-nowrap rounded px-2.5 py-1.5 text-[11.5px] transition-colors',
    isActive
      ? 'bg-[#1E3A5F] font-bold text-white'
      : 'font-medium text-[#4B5563] hover:bg-[#F3F4F6]',
  );

const utilityLinkClass = ({ isActive }: { isActive: boolean }): string =>
  cn(
    'inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2.5 py-1.5 text-[11.5px] transition-colors border',
    isActive
      ? 'border-transparent bg-[#1E3A5F] font-bold text-white'
      : 'border-[#E5E7EB] bg-white font-medium text-[#374151] hover:bg-[#F9FAFB]',
  );

export function TopNav(): JSX.Element {
  const user = useAppSelector(selectCurrentUser);
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
    <header className="sticky top-0 z-40 border-b border-[#E5E7EB] bg-white shadow-[0_1px_5px_rgba(0,0,0,0.07)]">
      {/* Row 1 — brand · utility tabs · audit · user pill */}
      <div className="mx-auto flex h-[50px] max-w-[1600px] items-center gap-2 px-4">
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
          {UTILITY_NAV.map((item) => (
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

      {/* Row 2 — primary nav */}
      <nav
        className="mx-auto flex min-h-[38px] max-w-[1600px] flex-wrap items-center gap-0.5 border-t border-[#F3F4F6] px-4"
        aria-label="Primary navigation"
      >
        {PRIMARY_NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end ?? false} className={primaryLinkClass}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <KpiGuideDrawer open={kpiOpen} onClose={() => setKpiOpen(false)} />
    </header>
  );
}
