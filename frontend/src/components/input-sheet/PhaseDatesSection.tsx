import { useMemo } from 'react';
import { Card, CardContent } from '../ui/card';
import { FormField } from './FormField';
import { FormSectionHeader } from './FormSectionHeader';
import type { ProjectDraft } from '../../hooks/useProjectDraft';
import type { CosEotItem } from '../../types/api';
import type { ProjectStageV2, ProjectStatus } from '../../types/api';

interface Props {
  draft: ProjectDraft;
  setField: <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) => void;
  cosItems: CosEotItem[];
}

/** New Project Stage dropdown (Phase A §3.2) — replaces the removed Current Phase. */
const PROJECT_STAGES_V2 = [
  'Conceptualisation',
  'Design',
  'Pre-Tender',
  'Tender',
  'Construction',
  'O&M',
  'Other',
] as const;

const STATUSES = ['Not Started', 'In Progress', 'Completed', 'On Hold', 'Delayed'] as const;

interface DelayInfo {
  total: number;
  covered: number;
  uncovered: number;
  eotGranted: number;
}

/** Reference JSX's delay math. See BUIDCO_Dashboard_v97 (1).jsx line ~3520. */
function computeDelay(
  plannedEndDate: string | null,
  revisedEndDate: string | null,
  latestCosRevisedDate: string | null,
  isCompleted: boolean,
  hasCoS: boolean,
): DelayInfo | null {
  if (!plannedEndDate) return null;
  if (isCompleted) return { total: 0, covered: 0, uncovered: 0, eotGranted: 0 };

  const planned = new Date(plannedEndDate);
  planned.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayMs = 86_400_000;

  const daysFromPlanned = Math.floor((today.getTime() - planned.getTime()) / dayMs);
  const effectiveRevised = hasCoS ? (revisedEndDate ?? latestCosRevisedDate) : null;

  if (effectiveRevised) {
    const revised = new Date(effectiveRevised);
    revised.setHours(0, 0, 0, 0);
    const eotGranted = Math.max(0, Math.floor((revised.getTime() - planned.getTime()) / dayMs));
    const totalDelay = Math.max(0, daysFromPlanned);
    const covered = Math.min(eotGranted, totalDelay);
    const beyondRevised = Math.max(0, Math.floor((today.getTime() - revised.getTime()) / dayMs));
    return { total: totalDelay, covered, uncovered: beyondRevised, eotGranted };
  }

  const totalDelay = Math.max(0, daysFromPlanned);
  return { total: totalDelay, covered: 0, uncovered: totalDelay, eotGranted: 0 };
}

export function PhaseDatesSection({ draft, setField, cosItems }: Props): JSX.Element {
  const isCompleted = draft.status === 'Completed';
  const hasCoS = cosItems.length > 0;

  const latestCosRevised = useMemo(() => {
    let best: string | null = null;
    for (const c of cosItems) {
      const cand = c.revisedDate ?? c.newEndDate;
      if (cand && (best === null || cand > best)) best = cand;
    }
    return best;
  }, [cosItems]);

  const delayInfo = useMemo(
    () => computeDelay(draft.plannedEndDate, draft.revisedEndDate, latestCosRevised, isCompleted, hasCoS),
    [draft.plannedEndDate, draft.revisedEndDate, latestCosRevised, isCompleted, hasCoS],
  );

  return (
    <Card>
      <CardContent className="pt-4">
        <FormSectionHeader
          num="02"
          title="Phase, Status & Dates"
          sub="Revised End Date auto-fills from the latest CoS if left blank"
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <FormField
            label="Project Stage"
            type="select"
            value={draft.projectStageV2 ?? ''}
            onChange={(v) => setField('projectStageV2', (v as ProjectStageV2) || null)}
            options={PROJECT_STAGES_V2 as unknown as string[]}
            required
          />
          <FormField
            label="Execution Status"
            type="select"
            value={draft.status}
            onChange={(v) => setField('status', v as ProjectStatus)}
            options={STATUSES as unknown as string[]}
          />
          <FormField
            label="Planned End Date"
            type="date"
            value={draft.plannedEndDate}
            onChange={(v) => setField('plannedEndDate', v || null)}
          />
          <FormField
            label="Revised End Date (auto/override)"
            type="date"
            value={draft.revisedEndDate ?? latestCosRevised ?? ''}
            onChange={(v) => setField('revisedEndDate', v || null)}
            hint={
              latestCosRevised && !draft.revisedEndDate
                ? `↳ auto from latest CoS (${latestCosRevised})`
                : ''
            }
          />
          <FormField
            label="Expected Completion (date)"
            type="date"
            value={draft.expectedCompletionDate}
            onChange={(v) => setField('expectedCompletionDate', v || null)}
          />
          <FormField
            label="Expected Completion (raw text)"
            value={draft.expectedCompletionRaw}
            onChange={(v) => setField('expectedCompletionRaw', v || null)}
            hint="Fallback if the raw source isn't a real date."
          />
          <div className="md:col-span-3">
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[#374151]">
              Delay (Days) — auto-calculated
            </div>
            <div className="mt-1 rounded border border-[#E5E7EB] px-3 py-2 text-[13px] font-bold">
              {renderDelay(delayInfo, isCompleted)}
            </div>
          </div>
          <FormField
            label="Delay Reason / Root Cause"
            type="textarea"
            rows={2}
            value={draft.delayReason}
            onChange={(v) => setField('delayReason', v || null)}
            className="md:col-span-3"
          />
          <FormField
            label="Department / Agency Stuck At"
            value={draft.deptStuckAt}
            onChange={(v) => setField('deptStuckAt', v || null)}
            className="md:col-span-3"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function renderDelay(info: DelayInfo | null, isCompleted: boolean): JSX.Element {
  if (info === null) return <span className="text-[#9CA3AF]">— Set Planned End Date</span>;
  if (isCompleted) return <span className="text-[#15803D]">0 (Completed ✓)</span>;
  const { total, uncovered, eotGranted } = info;
  if (eotGranted > 0 && total === 0 && uncovered === 0) {
    return (
      <span className="text-[#B45309]">
        EoT granted: {eotGranted} days (planned deadline not yet breached)
      </span>
    );
  }
  if (total === 0) return <span className="text-[#15803D]">0 (On Track ✓)</span>;
  if (uncovered === 0) return <span className="text-[#B45309]">{total} days delayed — covered by EoT ✓</span>;
  return (
    <span className="text-[#B91C1C]">
      {total} days delayed ⚠ ({uncovered} days beyond EoT)
    </span>
  );
}
