import { useMemo } from 'react';
import { Card, CardContent } from '../ui/card';
import { FormField } from './FormField';
import { FormSectionHeader } from './FormSectionHeader';
import { isTenderCompleted } from '../../features/tender/tenderWorkflow';
import type { ProjectDraft } from '../../hooks/useProjectDraft';
import type { CosEotItem } from '../../types/api';
import type { ProjectStageV2, ProjectStatus } from '../../types/api';

interface Props {
  projectId: string | null;
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

export function PhaseDatesSection({ projectId: _projectId, draft, setField, cosItems }: Props): JSX.Element {
  const isCompleted = draft.status === 'Completed';
  // Tender_Dashboard.md §9 — Construction unlocks only after the project has
  // been advanced through the Tender workflow to Work Order Issued. O&M
  // stays gated until Construction has been picked AND marked Completed
  // (Execution Status). Rows already at Construction/O&M keep the option
  // available so their existing selection round-trips cleanly.
  const tenderComplete = isTenderCompleted({
    projectStageV2: draft.projectStageV2,
    tenderSubStage: draft.tenderSubStage,
  });
  const constructionAllowed = tenderComplete || draft.projectStageV2 === 'Construction';
  const omAllowed =
    (constructionAllowed && isCompleted) || draft.projectStageV2 === 'O&M';
  const stageOptions = PROJECT_STAGES_V2.map((s) => {
    if (s === 'Construction' && !constructionAllowed) {
      return { value: s, label: `${s} — locked until Tender complete`, disabled: true };
    }
    if (s === 'O&M' && !omAllowed) {
      return { value: s, label: `${s} — locked until Construction complete`, disabled: true };
    }
    return { value: s, label: s };
  });
  const stageHint = !constructionAllowed
    ? 'Construction unlocks after the Tender workflow reaches Work Order Issued.'
    : !omAllowed
      ? 'O&M unlocks once Construction is marked Completed (Execution Status).'
      : undefined;
  // Only CoS rows flagged Time Linked = YES flow into the project schedule.
  // Rows with Time Linked = NO are independent bookkeeping and must not
  // shift Revised End Date or the delay math (Instruction §3).
  const linkedCosItems = useMemo(
    () => cosItems.filter((c) => c.timeLinked),
    [cosItems],
  );
  const hasLinkedCoS = linkedCosItems.length > 0;

  const latestCosRevised = useMemo(() => {
    let best: string | null = null;
    for (const c of linkedCosItems) {
      const cand = c.revisedDate ?? c.newEndDate;
      if (cand && (best === null || cand > best)) best = cand;
    }
    return best;
  }, [linkedCosItems]);

  const delayInfo = useMemo(
    () => computeDelay(draft.plannedEndDate, draft.revisedEndDate, latestCosRevised, isCompleted, hasLinkedCoS),
    [draft.plannedEndDate, draft.revisedEndDate, latestCosRevised, isCompleted, hasLinkedCoS],
  );

  return (
    <Card>
      <CardContent className="pt-4">
        <FormSectionHeader
          num="01"
          title="Phase, Status & Dates"
          sub="Revised End Date auto-fills from the latest CoS if left blank"
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <FormField
            label="Project Stage"
            type="select"
            value={draft.projectStageV2 ?? ''}
            onChange={(v) => setField('projectStageV2', (v as ProjectStageV2) || null)}
            options={stageOptions}
            required
            hint={stageHint ?? ''}
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
