import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useGetLookupsQuery } from '../../app/api/lookupsApi';
import { useGetProjectQuery } from '../../app/api/projectsApi';
import { useListCosEotForProjectQuery } from '../../app/api/cosEotApi';
import { useListMgmtActionsForProjectQuery } from '../../app/api/mgmtActionsApi';
import { useListMilestonesQuery } from '../../app/api/milestonesApi';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { OmAlertCell } from './OmAlertCell';
import { PbgAlertCell } from './PbgAlertCell';
import { PriorityBadge } from './PriorityBadge';
import { ProgressBar } from './ProgressBar';
import { StatusBadge } from './StatusBadge';
import { cn } from '../../lib/utils';
import { formatCurrencyCr, formatDate, formatPercent } from '../../lib/formatters';

interface Props {
  projectId: string | null;
  onClose: () => void;
}

/**
 * Slide-up / centered modal showing a full project profile. Opened from
 * the Schemes / Sectors / Districts drill-through so users can inspect a
 * project inline without losing their filter context.
 *
 * Escape closes it. Background click closes it. Contents scroll internally.
 */
export function ProjectProfileModal({ projectId, onClose }: Props): JSX.Element | null {
  const enabled = projectId !== null;
  const detail = useGetProjectQuery(projectId ?? '', { skip: !enabled });
  const cosEot = useListCosEotForProjectQuery(projectId ?? '', { skip: !enabled });
  const mgmt = useListMgmtActionsForProjectQuery(projectId ?? '', { skip: !enabled });
  const milestones = useListMilestonesQuery(projectId ?? '', { skip: !enabled });
  const lookups = useGetLookupsQuery(undefined, { skip: !enabled });

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled, onClose]);

  useEffect(() => {
    if (!enabled) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [enabled]);

  if (!enabled) return null;

  const project = detail.data;
  const sectorName = project?.sectorId
    ? lookups.data?.sectors.find((s) => s.sectorId === project.sectorId)?.sectorName
    : null;
  const districtName = project?.districtId
    ? lookups.data?.districts.find((d) => d.districtId === project.districtId)?.districtName
    : null;
  const schemeNames = (project?.schemes ?? []).map(
    (id) => lookups.data?.schemes.find((s) => s.schemeId === id)?.schemeName ?? `#${id}`,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Project profile"
    >
      <button
        type="button"
        aria-label="Close project profile"
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative my-4 w-full max-w-5xl rounded-lg border border-[#E5E7EB] bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-2 rounded-t-lg border-b border-[#E5E7EB] bg-white px-5 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">
              Project Profile
              {sectorName ? <span className="ml-2 text-[#374151]">· {sectorName}</span> : null}
              {districtName ? <span className="ml-2 text-[#374151]">· {districtName}</span> : null}
            </p>
            <h2 className="mt-0.5 break-words text-[15px] font-bold text-[#111827]">
              {project?.projectName ?? '—'}
            </h2>
            {project ? (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={project.status} />
                <PriorityBadge priority={project.priority} />
                {project.projectStage ? (
                  <span className="rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-[#1E3A5F]">
                    Stage · {project.projectStage}
                  </span>
                ) : null}
                {project.workType ? (
                  <span className="rounded-full border border-[#D1D5DB] bg-[#F9FAFB] px-2 py-0.5 text-[10.5px] font-semibold text-[#374151]">
                    {project.workType}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {project ? (
              <NavLink
                to={`/projects/${project.projectId}`}
                onClick={onClose}
                className="inline-flex h-8 items-center rounded border border-[#D1D5DB] bg-white px-3 text-[12px] font-medium text-[#374151] hover:bg-[#F9FAFB]"
              >
                Open full detail →
              </NavLink>
            ) : null}
            <Button size="sm" variant="outline" onClick={onClose} aria-label="Close">
              ✕
            </Button>
          </div>
        </header>

        <div className="px-5 py-4">
          {detail.isLoading || !project ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Headline metrics */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Metric
                  label="Effective Physical %"
                  value={formatPercent(project.effectivePhysicalPct)}
                >
                  <ProgressBar
                    value={project.effectivePhysicalPct}
                    color="#1D4ED8"
                    showLabel={false}
                  />
                  <span
                    className={cn(
                      'mt-1 text-[10px] font-semibold uppercase tracking-wider',
                      project.isMilestoneWeighted ? 'text-[#15803D]' : 'text-[#6B7280]',
                    )}
                  >
                    {project.isMilestoneWeighted ? 'Milestone-weighted' : 'Manual entry'}
                  </span>
                </Metric>
                <Metric label="Financial %" value={formatPercent(project.financialProgressPct)}>
                  <ProgressBar
                    value={project.financialProgressPct}
                    color="#22C55E"
                    showLabel={false}
                  />
                </Metric>
                <Metric label="AA Amount" value={formatCurrencyCr(project.aaAmountCr)}>
                  <span className="text-[11px] text-[#6B7280]">
                    Agreement: {formatCurrencyCr(project.agreementAmountCr)}
                  </span>
                </Metric>
              </div>

              {/* Field grids */}
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <FieldCard title="Overview">
                  <FieldGrid
                    fields={[
                      { label: 'City', value: project.city },
                      { label: 'District', value: districtName },
                      { label: 'Sector', value: sectorName },
                      {
                        label: 'Scheme(s)',
                        value: schemeNames.length > 0 ? schemeNames.join(', ') : null,
                      },
                      { label: 'Contractor', value: project.contractor },
                      { label: 'PD', value: project.pd },
                      { label: 'Sponsoring Dept', value: project.sponsoringDept },
                      { label: 'Implementing Agency', value: project.implementingAgency },
                      { label: 'Current Phase', value: project.currentPhase },
                    ]}
                  />
                </FieldCard>

                <FieldCard title="Schedule & Delay">
                  <FieldGrid
                    fields={[
                      { label: 'Sanction Date', value: formatDate(project.sanctionDate) },
                      { label: 'Planned End Date', value: formatDate(project.plannedEndDate) },
                      { label: 'Revised End Date', value: formatDate(project.revisedEndDate) },
                      {
                        label: 'Expected Completion',
                        value:
                          formatDate(project.expectedCompletionDate) === '—'
                            ? project.expectedCompletionRaw ?? '—'
                            : formatDate(project.expectedCompletionDate),
                      },
                      {
                        label: 'Scheduled Progress %',
                        value: formatPercent(project.scheduledProgressPct),
                      },
                      { label: 'Delay Reason', value: project.delayReason },
                      { label: 'Department Stuck At', value: project.deptStuckAt },
                    ]}
                  />
                </FieldCard>

                <FieldCard title="Contract & Financial (₹ Cr)">
                  <FieldGrid
                    fields={[
                      { label: 'Agreement Number', value: project.agreementNumber },
                      { label: 'Agreement Date', value: formatDate(project.agreementDate) },
                      { label: 'Appointed Date', value: formatDate(project.appointedDate) },
                      { label: 'Contract Value', value: formatCurrencyCr(project.contractValueCr) },
                      {
                        label: 'Mobilisation Issued',
                        value: formatCurrencyCr(project.mobAdvanceIssuedCr),
                      },
                      {
                        label: 'Mobilisation Recovered',
                        value: formatCurrencyCr(project.mobAdvanceRecoveredCr),
                      },
                      {
                        label: 'Advance Outstanding',
                        value: formatCurrencyCr(project.advanceOutstandingCr),
                      },
                      {
                        label: 'Retention Held',
                        value: formatCurrencyCr(project.retentionMoneyHeldCr),
                      },
                      { label: 'Total Payments', value: formatCurrencyCr(project.totalPaymentsCr) },
                      { label: 'Last Payment Date', value: formatDate(project.lastPaymentDate) },
                      { label: 'Last RA Bill No.', value: project.lastRaBillNo },
                    ]}
                  />
                </FieldCard>

                <FieldCard title="PBG & EMD">
                  <FieldGrid
                    fields={[
                      { label: 'PBG Number', value: project.pbgNumber },
                      { label: 'PBG Amount', value: formatCurrencyCr(project.pbgAmountCr) },
                      { label: 'PBG Issuing Bank', value: project.pbgIssuingBank },
                      { label: 'PBG Expiry Date', value: formatDate(project.pbgExpiryDate) },
                      { label: 'EMD Amount', value: formatCurrencyCr(project.emdAmountCr) },
                      { label: 'EMD Reference', value: project.emdRefNumber },
                      { label: 'EMD Date', value: formatDate(project.emdDate) },
                    ]}
                  />
                  <div className="mt-2">
                    <PbgAlertCell pbgExpiryDate={project.pbgExpiryDate} />
                  </div>
                </FieldCard>

                <FieldCard title="O&M">
                  {!project.omApplicable ? (
                    <p className="text-[12.5px] text-[#6B7280]">Not applicable to this project.</p>
                  ) : (
                    <>
                      <FieldGrid
                        fields={[
                          { label: 'O&M Start', value: formatDate(project.omStartDate) },
                          { label: 'Period (months)', value: project.omPeriodMonths ?? '—' },
                          { label: 'O&M End', value: formatDate(project.omEndDate) },
                          { label: 'O&M Agency', value: project.omAgency },
                          { label: 'Status Override', value: project.omStatusOverride },
                        ]}
                      />
                      <div className="mt-2">
                        <OmAlertCell
                          status={project.status}
                          omApplicable={project.omApplicable}
                          omStartDate={project.omStartDate}
                          omEndDate={project.omEndDate}
                          omPeriodMonths={project.omPeriodMonths}
                          omStatusOverride={project.omStatusOverride}
                        />
                      </div>
                      {project.omRemarks ? (
                        <p className="mt-2 whitespace-pre-wrap text-[12px] text-[#374151]">
                          {project.omRemarks}
                        </p>
                      ) : null}
                    </>
                  )}
                </FieldCard>

                <FieldCard title="Outstanding Gap & Remarks">
                  {project.remark ? (
                    <p className="rounded border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#B91C1C]">
                      ⚠ {project.remark}
                    </p>
                  ) : (
                    <p className="text-[12.5px] text-[#6B7280]">No outstanding gap recorded.</p>
                  )}
                  {project.mainWork ? (
                    <div className="mt-3">
                      <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">
                        Main Work
                      </p>
                      <p className="whitespace-pre-wrap text-[12.5px] text-[#111827]">
                        {project.mainWork}
                      </p>
                    </div>
                  ) : null}
                  {project.projectBrief ? (
                    <div className="mt-3">
                      <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">
                        Project Brief
                      </p>
                      <p className="whitespace-pre-wrap text-[12.5px] text-[#111827]">
                        {project.projectBrief}
                      </p>
                    </div>
                  ) : null}
                </FieldCard>
              </div>

              {/* Nested resource summaries */}
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <FieldCard title={`CoS / EoT (${cosEot.data?.items.length ?? 0})`}>
                  {cosEot.isLoading ? (
                    <Skeleton className="h-12 w-full" />
                  ) : cosEot.data?.items.length ? (
                    <ul className="space-y-1 text-[12px]">
                      {cosEot.data.items.slice(0, 4).map((c) => (
                        <li
                          key={c.cosId}
                          className="flex items-center justify-between rounded border border-[#E5E7EB] px-2 py-1"
                        >
                          <span className="truncate font-semibold text-[#111827]">
                            {c.cosNumber ?? 'CoS'} · {c.category ?? '—'}
                          </span>
                          <span className="tabular-nums text-[#6B7280]">
                            {formatCurrencyCr(c.cosAmountCr)}
                            {c.eotDaysGranted ? ` · +${c.eotDaysGranted}d` : ''}
                          </span>
                        </li>
                      ))}
                      {cosEot.data.items.length > 4 ? (
                        <li className="text-[11px] italic text-[#6B7280]">
                          +{cosEot.data.items.length - 4} more…
                        </li>
                      ) : null}
                    </ul>
                  ) : (
                    <p className="text-[12px] text-[#6B7280]">No CoS/EoT records.</p>
                  )}
                </FieldCard>

                <FieldCard title={`Management Actions (${mgmt.data?.items.length ?? 0})`}>
                  {mgmt.isLoading ? (
                    <Skeleton className="h-12 w-full" />
                  ) : mgmt.data?.items.length ? (
                    <ul className="space-y-1 text-[12px]">
                      {mgmt.data.items.slice(0, 4).map((a) => (
                        <li
                          key={a.itemId}
                          className={cn(
                            'rounded border px-2 py-1 text-[#111827]',
                            a.status === 'Closed'
                              ? 'border-[#86EFAC] bg-[#F0FDF4]'
                              : 'border-[#FCA5A5] bg-[#FEF2F2]',
                          )}
                        >
                          {a.topic}
                        </li>
                      ))}
                      {mgmt.data.items.length > 4 ? (
                        <li className="text-[11px] italic text-[#6B7280]">
                          +{mgmt.data.items.length - 4} more…
                        </li>
                      ) : null}
                    </ul>
                  ) : (
                    <p className="text-[12px] text-[#6B7280]">No management actions.</p>
                  )}
                </FieldCard>

                <FieldCard title={`Milestones (${milestones.data?.items.length ?? 0})`}>
                  {milestones.isLoading ? (
                    <Skeleton className="h-12 w-full" />
                  ) : milestones.data?.items.length ? (
                    <ul className="space-y-1 text-[12px]">
                      {milestones.data.items.slice(0, 4).map((m) => (
                        <li
                          key={m.milestoneId}
                          className="flex items-center justify-between rounded border border-[#E5E7EB] px-2 py-1"
                        >
                          <span className="truncate">{m.milestoneName}</span>
                          <span className="tabular-nums text-[#374151]">{m.weightPct}%</span>
                        </li>
                      ))}
                      {milestones.data.items.length > 4 ? (
                        <li className="text-[11px] italic text-[#6B7280]">
                          +{milestones.data.items.length - 4} more…
                        </li>
                      ) : null}
                    </ul>
                  ) : (
                    <p className="text-[12px] text-[#6B7280]">No milestones yet.</p>
                  )}
                </FieldCard>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  children,
}: {
  label: string;
  value: React.ReactNode;
  children?: React.ReactNode;
}): JSX.Element {
  return (
    <div className="rounded border border-[#E5E7EB] bg-[#F9FAFB] p-3">
      <dt className="text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">{label}</dt>
      <dd className="mt-0.5 text-lg font-extrabold tabular-nums text-[#111827]">{value}</dd>
      {children ? <div className="mt-1.5">{children}</div> : null}
    </div>
  );
}

function FieldCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section className="rounded border border-[#E5E7EB] bg-white p-3 shadow-sm">
      <h3 className="mb-2 border-b border-[#F3F4F6] pb-1 text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function FieldGrid({
  fields,
}: {
  fields: Array<{ label: string; value: React.ReactNode }>;
}): JSX.Element {
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
      {fields.map((f) => (
        <div key={f.label} className="min-w-0">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
            {f.label}
          </dt>
          <dd className="truncate text-[#111827]">{f.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
