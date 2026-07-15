import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BUIDCO_LOGO_URI } from '../../assets/buidcoLogo';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  dismissMdBriefing,
  selectShowMdBriefing,
} from '../../features/auth/authSlice';
import { MdSchemeSummaryModal } from '../md/MdSchemeSummaryModal';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';

/** localStorage key for the desktop sidebar collapsed preference. */
const LS_SIDEBAR = 'buidco_sidebar_collapsed_v1';

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(LS_SIDEBAR) === '1';
  } catch {
    return false;
  }
}

function saveCollapsed(v: boolean): void {
  try { localStorage.setItem(LS_SIDEBAR, v ? '1' : '0'); } catch { /* quota */ }
}

export function AppShell(): JSX.Element {
  const dispatch = useAppDispatch();
  const showMdBriefing = useAppSelector(selectShowMdBriefing);
  const [collapsed, setCollapsed] = useState<boolean>(() => loadCollapsed());
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const location = useLocation();

  // Auto-close the mobile drawer whenever the user navigates. On desktop the
  // NavLink's onClick would still fire onCloseMobile but no drawer is open,
  // so this is a defence-in-depth for programmatic navigation (e.g. redirects).
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const toggleCollapsed = (): void => {
    setCollapsed((prev) => {
      const next = !prev;
      saveCollapsed(next);
      return next;
    });
  };

  return (
    <div className="relative min-h-screen bg-[#F4F6F9] font-sans text-[#111827]">
      {/* Faded BUIDCO watermark — same pattern as the reference JSX. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[length:480px_480px] bg-center bg-no-repeat opacity-[0.08]"
        style={{ backgroundImage: `url(${BUIDCO_LOGO_URI})` }}
      />
      <div className="relative z-10 flex min-h-screen flex-col">
        <TopNav onOpenMobileNav={() => setMobileOpen(true)} />
        <div className="flex flex-1">
          <Sidebar
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
          />
          <main className="min-w-0 flex-1 px-4 py-6">
            <div className="mx-auto max-w-[1400px]">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <MdSchemeSummaryModal
        open={showMdBriefing}
        onClose={() => dispatch(dismissMdBriefing())}
      />
    </div>
  );
}
