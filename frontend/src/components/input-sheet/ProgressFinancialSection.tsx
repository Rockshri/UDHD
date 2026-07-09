import { Card, CardContent } from '../ui/card';
import { FormSectionHeader } from './FormSectionHeader';
import { NumberField } from './NumberField';
import type { ProjectDraft } from '../../hooks/useProjectDraft';
import type { CosEotItem } from '../../types/api';

interface Props {
  draft: ProjectDraft;
  setField: <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) => void;
  cosItems: CosEotItem[];
}

export function ProgressFinancialSection({ draft, setField, cosItems }: Props): JSX.Element {
  const totalEotDays = cosItems.reduce((sum, c) => sum + (c.eotDaysGranted ?? 0), 0);

  return (
    <Card>
      <CardContent className="pt-4">
        <FormSectionHeader
          num="03"
          title="Progress & Financial"
          sub="CoS count and total EoT days are auto-derived from Section 04"
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <NumberField
            label="Sanctioned Cost"
            suffix="₹ Cr"
            value={draft.sanctionedCostCr}
            onChange={(v) => setField('sanctionedCostCr', v)}
          />
          <NumberField
            label="Physical Progress % (Actual)"
            suffix="%"
            min={0}
            max={100}
            value={draft.physicalProgressPct}
            onChange={(v) => setField('physicalProgressPct', v)}
          />
          <NumberField
            label="Physical Progress % (Scheduled)"
            suffix="%"
            min={0}
            max={100}
            value={draft.scheduledProgressPct}
            onChange={(v) => setField('scheduledProgressPct', v)}
          />
          <NumberField
            label="Financial Progress %"
            suffix="%"
            min={0}
            max={100}
            value={draft.financialProgressPct}
            onChange={(v) => setField('financialProgressPct', v)}
          />
          <ReadOnlyMetric label="Total CoS Count (auto)" value={String(cosItems.length)} />
          <ReadOnlyMetric label="Total EoT Days (auto)" value={`${totalEotDays} d`} />
          <NumberField
            label="AA Amount"
            suffix="₹ Cr"
            value={draft.aaAmountCr}
            onChange={(v) => setField('aaAmountCr', v)}
          />
          <NumberField
            label="Agreement Amount"
            suffix="₹ Cr"
            value={draft.agreementAmountCr}
            onChange={(v) => setField('agreementAmountCr', v)}
          />
          <NumberField
            label="Financial Progress"
            suffix="₹ Cr"
            value={draft.financialProgressCr}
            onChange={(v) => setField('financialProgressCr', v)}
          />
        </div>

        <div className="mt-4 border-t border-[#F3F4F6] pt-3">
          <div className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">
            ▌ Monthly Progress Report (MPR) — optional
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              type="text"
              value={draft.mprMonth ?? ''}
              onChange={(e) => setField('mprMonth', e.target.value || null)}
              placeholder="MPR Month (e.g. Jun 2026)"
              className="h-9 rounded border border-[#D1D5DB] px-3 text-[13px]"
            />
            <NumberField
              label="Fund Received"
              suffix="₹ Cr"
              value={draft.fundReceivedCr}
              onChange={(v) => setField('fundReceivedCr', v)}
            />
            <input
              type="text"
              value={draft.expenditureCentralRaw ?? ''}
              onChange={(e) => setField('expenditureCentralRaw', e.target.value || null)}
              placeholder="Expenditure — Central Share (raw)"
              className="h-9 rounded border border-[#D1D5DB] px-3 text-[13px]"
            />
            <input
              type="text"
              value={draft.expenditureStateRaw ?? ''}
              onChange={(e) => setField('expenditureStateRaw', e.target.value || null)}
              placeholder="Expenditure — State Share (raw)"
              className="h-9 rounded border border-[#D1D5DB] px-3 text-[13px]"
            />
            <input
              type="text"
              value={draft.manpowerEngagedRaw ?? ''}
              onChange={(e) => setField('manpowerEngagedRaw', e.target.value || null)}
              placeholder="Manpower Engaged (nos.)"
              className="h-9 rounded border border-[#D1D5DB] px-3 text-[13px]"
            />
            <input
              type="text"
              value={draft.progressPrevMonthRaw ?? ''}
              onChange={(e) => setField('progressPrevMonthRaw', e.target.value || null)}
              placeholder="Progress — up to previous month"
              className="h-9 rounded border border-[#D1D5DB] px-3 text-[13px]"
            />
            <input
              type="text"
              value={draft.progressThisMonthRaw ?? ''}
              onChange={(e) => setField('progressThisMonthRaw', e.target.value || null)}
              placeholder="Progress — during this month"
              className="h-9 rounded border border-[#D1D5DB] px-3 text-[13px]"
            />
            <textarea
              value={draft.mainComponentScope ?? ''}
              onChange={(e) => setField('mainComponentScope', e.target.value || null)}
              placeholder="Main Component (with scope)"
              rows={2}
              className="rounded border border-[#D1D5DB] px-3 py-1.5 text-[13px] md:col-span-2"
            />
            <textarea
              value={draft.mprRemark ?? ''}
              onChange={(e) => setField('mprRemark', e.target.value || null)}
              placeholder="MPR Remarks / Issues in Execution"
              rows={2}
              className="rounded border border-[#D1D5DB] px-3 py-1.5 text-[13px] md:col-span-3"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReadOnlyMetric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="grid gap-1">
      <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[#374151]">
        {label}
      </span>
      <div className="flex h-9 items-center rounded border border-[#E5E7EB] bg-[#EFF6FF] px-3 text-[13px] font-bold text-[#1D4ED8]">
        {value}
      </div>
    </div>
  );
}
