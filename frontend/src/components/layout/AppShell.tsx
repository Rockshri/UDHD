import { Outlet } from 'react-router-dom';
import { BUIDCO_LOGO_URI } from '../../assets/buidcoLogo';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  dismissMdBriefing,
  selectShowMdBriefing,
} from '../../features/auth/authSlice';
import { MdSchemeSummaryModal } from '../md/MdSchemeSummaryModal';
import { TopNav } from './TopNav';

export function AppShell(): JSX.Element {
  const dispatch = useAppDispatch();
  const showMdBriefing = useAppSelector(selectShowMdBriefing);

  return (
    <div className="relative min-h-screen bg-[#F4F6F9] font-sans text-[#111827]">
      {/* Faded BUIDCO watermark — same pattern as the reference JSX. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[length:480px_480px] bg-center bg-no-repeat opacity-[0.08]"
        style={{ backgroundImage: `url(${BUIDCO_LOGO_URI})` }}
      />
      <div className="relative z-10">
        <TopNav />
        <main className="mx-auto max-w-[1600px] px-4 py-6">
          <Outlet />
        </main>
      </div>
      <MdSchemeSummaryModal
        open={showMdBriefing}
        onClose={() => dispatch(dismissMdBriefing())}
      />
    </div>
  );
}
