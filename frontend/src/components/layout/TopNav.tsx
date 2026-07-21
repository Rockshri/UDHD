import { Menu } from 'lucide-react';
import { BuidcoLogo } from './BuidcoLogo';
import { NavClock } from './NavClock';
import { UserPill } from './UserPill';
import { UtilityNavCluster } from './UtilityNav';

interface TopNavProps {
  /** Opens the mobile sidebar drawer (< lg only). */
  onOpenMobileNav: () => void;
  /** Opens the KPI reference guide drawer (state lives in AppShell so both
   *  the desktop TopNav button and the mobile drawer's copy can trigger it). */
  onOpenKpiGuide: () => void;
}

export function TopNav({ onOpenMobileNav, onOpenKpiGuide }: TopNavProps): JSX.Element {
  return (
    <header className="sticky top-0 z-50 border-b border-[#E5E7EB] bg-white shadow-[0_1px_5px_rgba(0,0,0,0.07)]">
      {/* Row 1 — hamburger (mobile) · brand · utility tabs · audit · user pill.
          Below `lg` this collapses to just hamburger + logo — everything
          else (utility links, KPI Guide, Audit Trail, Users, clock, user
          pill/sign-out) relocates into the mobile sidebar drawer instead. */}
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

        <UtilityNavCluster
          onOpenKpiGuide={onOpenKpiGuide}
          className="ml-auto hidden flex-shrink-0 items-center gap-1.5 lg:flex"
        />

        <div className="ml-auto hidden flex-shrink-0 items-center gap-1.5 lg:flex">
          <NavClock />
          <UserPill />
        </div>
      </div>

      {/* Primary navigation lives in the left sidebar (Read.md §1). */}
    </header>
  );
}
