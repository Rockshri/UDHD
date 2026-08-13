import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Menu } from 'lucide-react';
import { useLogoutMutation } from '../../app/api/authApi';
import { useGetLookupsQuery } from '../../app/api/lookupsApi';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  openMdBriefing,
  selectCurrentUser,
} from '../../features/auth/authSlice';
import { cn } from '../../lib/utils';
import type { UserRole } from '../../types/api';
import { RoleGate } from '../auth/RoleGate';
import { BuidcoLogo } from './BuidcoLogo';
import { NavClock } from './NavClock';

/** Full-form role labels for the header user pill (PD_role.md §2/§3). */
const ROLE_DISPLAY: Record<UserRole, string> = {
  MD: 'Managing Director',
  Admin: 'Admin',
  PD: 'Project Director',
  Viewer: 'Viewer',
};

/**
 * The 10 primary-nav items moved into the left sidebar per Read.md §1.
 * TopNav now only carries the utility pills (Input Sheet / MoM / O&M),
 * MD-only chips (Audit Trail / MD Briefing), KPI Guide, clock,
 * and user profile dropdown.
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
  /** Opens the KPI Guide drawer — state lives in AppShell so the mobile
   *  Sidebar drawer can trigger it too. */
  onOpenKpiGuide: () => void;
}

export function TopNav({ onOpenMobileNav, onOpenKpiGuide }: TopNavProps): JSX.Element {
  // Lookups powers the division-name label for PD pills. Query is cheap
  // (cached 1h in RTK Query) and skipped for non-authenticated sessions.
  const { data: lookups } = useGetLookupsQuery();
  const user = useAppSelector(selectCurrentUser);
  const dispatch = useAppDispatch();
  const [logout, { isLoading: loggingOut }] = useLogoutMutation();
  const navigate = useNavigate();

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
      {/* Row 1 — hamburger (mobile) · brand · utility tabs · audit · user pill.
          Below `lg` (< 1024px) the utility pills move into the sidebar drawer
          to keep this bar from overflowing on tablets and small laptops. */}
      <div className="mx-auto flex h-[50px] items-center gap-2 px-3 sm:px-4">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="rounded-md p-1.5 text-[#374151] hover:bg-[#F3F4F6] lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <div className="flex flex-shrink-0 items-center gap-2 border-r border-[#E5E7EB] pr-2 sm:pr-3">
          <BuidcoLogo size={32} />
          <div className="hidden sm:block">
            <div className="text-[13px] font-extrabold leading-tight tracking-wide text-[#111827]">
              BUIDCO
            </div>
            <div className="text-[8px] uppercase tracking-[0.06em] text-[#6B7280]">
              Project Monitoring System
            </div>
          </div>
        </div>

        <nav
          className="ml-auto hidden flex-shrink-0 items-center gap-1.5 lg:flex"
          aria-label="Utility navigation"
        >
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

        <div className="ml-auto flex flex-shrink-0 items-center gap-1.5 lg:ml-0">
          <button
            type="button"
            onClick={onOpenKpiGuide}
            className={cn(
              'hidden lg:inline-flex items-center gap-1.5 whitespace-nowrap rounded border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB]',
            )}
            aria-label="Open KPI reference guide"
          >
            <span aria-hidden>❓</span> KPI Guide
          </button>
          <RoleGate allow={['MD']}>
            <NavLink to="/audit" className={({ isActive }) => cn(utilityLinkClass({ isActive }), 'hidden lg:inline-flex')}>
              <span aria-hidden>🕒</span> Audit Trail
            </NavLink>
          </RoleGate>
          {/* '👥 Users' chip removed — User Management now lives in the left
              sidebar (MD/Admin only). */}

          {/* Clock hides on the smallest screens (< sm, <640px) where the pill
              would push the UserPill off-screen. */}
          <div className="hidden sm:block">
            <NavClock />
          </div>

          <UserPill
            user={user}
            divisionName={
              user?.role === 'PD' && user.divisionId !== undefined
                ? lookups?.divisions.find((d) => d.divisionId === user.divisionId)?.divisionName
                    ?? `#${user.divisionId}`
                : null
            }
            loggingOut={loggingOut}
            onSignOut={onSignOut}
          />
        </div>
      </div>

      {/* Primary navigation lives in the left sidebar (Read.md §1).
          KpiGuideDrawer is rendered from AppShell so both TopNav and Sidebar
          can trigger it via `onOpenKpiGuide`. */}
    </header>
  );
}

/**
 * Header user pill — trigger + dropdown menu (PD_role.md §2/§3).
 *
 * Trigger (always visible in header): 🟢 online dot · display name · chevron.
 * Menu (opens on click): full profile block (Name, Role, Division for PDs,
 * Username) + Sign out button.
 *
 * Clicking outside the menu, pressing Escape, or clicking any menu item
 * closes it. The trigger has aria-expanded so screen readers announce it as
 * a disclosure button.
 */
function UserPill({
  user, divisionName, loggingOut, onSignOut,
}: {
  user: ReturnType<typeof selectCurrentUser> extends infer U ? U : never;
  divisionName: string | null;
  loggingOut: boolean;
  onSignOut: () => Promise<void>;
}): JSX.Element {
  // PDs display as `PD.<division_name lowercased>` (e.g. PD.darbhanga) so
  // the pill immediately identifies which division the user is scoped to.
  // Falls back to fullName / username if the division lookup hasn't loaded.
  const displayName =
    user?.role === 'PD' && divisionName
      ? `PD.${divisionName.toLowerCase().replace(/\s+/g, '_')}`
      : user?.fullName || user?.username || '—';
  const roleLabel = user ? (ROLE_DISPLAY[user.role] ?? user.role) : '—';
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click + Escape. One combined effect so we can register
  // both listeners atomically for the duration the menu is open.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleSignOut = async (): Promise<void> => {
    setOpen(false);
    await onSignOut();
  };

  return (
    <div ref={rootRef} className="relative">
      {/* Trigger — compact: green dot + display name + chevron */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'flex h-8 items-center gap-2 rounded-lg border bg-white pl-2.5 pr-1.5 transition-colors',
          open
            ? 'border-[#1E3A5F] shadow-sm'
            : 'border-[#E5E7EB] hover:border-[#D1D5DB] hover:bg-[#F9FAFB]',
        )}
      >
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#22C55E]"
          aria-hidden
          title="Online"
        />
        <span className="max-w-[140px] truncate text-[11.5px] font-bold text-[#111827]">
          {displayName}
        </span>
        <ChevronDown
          size={13}
          aria-hidden
          className={cn(
            'shrink-0 text-[#6B7280] transition-transform',
            open ? 'rotate-180' : '',
          )}
        />
      </button>

      {/* Menu */}
      {open ? (
        <div
          role="menu"
          aria-label="Account menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-[240px] overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-xl"
        >
          {/* Profile block */}
          <div className="border-b border-[#F3F4F6] px-3 py-3">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1E3A5F] text-[13px] font-bold text-white"
              >
                {getInitials(displayName)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold text-[#111827]">{displayName}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider text-[#6B7280]">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-[#22C55E]"
                    aria-hidden
                  />
                  Online
                </p>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[11.5px]">
              <dt className="font-semibold uppercase tracking-wider text-[#6B7280]">Role</dt>
              <dd className="truncate text-[#111827]">{roleLabel}</dd>
              {divisionName ? (
                <>
                  <dt className="font-semibold uppercase tracking-wider text-[#6B7280]">
                    Division
                  </dt>
                  <dd className="truncate font-semibold text-[#6D28D9]">{divisionName}</dd>
                </>
              ) : null}
              {user?.username && user.username !== displayName ? (
                <>
                  <dt className="font-semibold uppercase tracking-wider text-[#6B7280]">
                    Username
                  </dt>
                  <dd className="truncate text-[#374151]">{user.username}</dd>
                </>
              ) : null}
            </dl>
          </div>

          {/* Actions */}
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={loggingOut}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] font-medium text-[#B91C1C] transition-colors hover:bg-[#FEF2F2] disabled:opacity-60"
          >
            <LogOut size={14} aria-hidden />
            {loggingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Two-letter initials from the display name for the account-menu avatar.
 * "Sarah Khan" → "SK"; "shri" → "SH"; falls back to "?" for empty strings.
 */
function getInitials(name: string): string {
  const clean = name.trim();
  if (!clean || clean === '—') return '?';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return (parts[0] ?? '').slice(0, 2).toUpperCase() || '?';
  }
  const first = parts[0]?.[0] ?? '';
  const last = parts[parts.length - 1]?.[0] ?? '';
  return (first + last).toUpperCase() || '?';
}
