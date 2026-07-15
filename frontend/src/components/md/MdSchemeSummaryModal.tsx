import { useEffect, useMemo, useRef, useState } from 'react';
import { useGetLookupsQuery } from '../../app/api/lookupsApi';
import {
  useGetDelayStatusQuery,
  useGetSchemeKpiSummaryQuery,
} from '../../app/api/kpisApi';
import { useGetProjectQuery, useListProjectsQuery } from '../../app/api/projectsApi';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { OmAlertCell } from '../projects/OmAlertCell';
import { PbgAlertCell } from '../projects/PbgAlertCell';
import { PriorityBadge } from '../projects/PriorityBadge';
import { ProgressBar } from '../projects/ProgressBar';
import { StatusBadge } from '../projects/StatusBadge';
import type { ProjectDetail, ProjectListItem, SchemeKpiSummaryRow } from '../../types/api';
import { cn } from '../../lib/utils';
import { formatCurrencyCr, formatDate, formatPercent } from '../../lib/formatters';

// ── Colour palette per scheme card (mirrors SchemesPage) ─────────────────────
const SCHEME_COLORS = [
  '#1E3A5F', '#2563EB', '#3B82F6', '#60A5FA',
  '#93C5FD', '#A5B4FC', '#C7D2FE', '#7C3AED',
];

// ── Left-side KPI field catalog ──────────────────────────────────────────────
type KpiKey =
  | 'total' | 'completed' | 'inProgress' | 'delayed' | 'onHold' | 'notStarted'
  | 'avgPhysicalPct' | 'avgFinancialPct' | 'financialUtilisationPct'
  | 'totalAaCr' | 'totalFinancialCr'
  | 'needsAttention';

interface KpiFieldDef { key: KpiKey; label: string; defaultOn: boolean }
interface KpiGroupDef { group: string; fields: KpiFieldDef[] }

const KPI_GROUPS: KpiGroupDef[] = [
  {
    group: 'Status Breakdown',
    fields: [
      { key: 'total',       label: 'Total Projects', defaultOn: true },
      { key: 'completed',   label: 'Completed',       defaultOn: true },
      { key: 'inProgress',  label: 'In Progress',     defaultOn: true },
      { key: 'delayed',     label: 'Delayed',         defaultOn: true },
      { key: 'onHold',      label: 'On Hold',         defaultOn: false },
      { key: 'notStarted',  label: 'Not Started',     defaultOn: false },
    ],
  },
  {
    group: 'Progress Metrics',
    fields: [
      { key: 'avgPhysicalPct',           label: 'Avg Physical %',         defaultOn: true },
      { key: 'avgFinancialPct',          label: 'Avg Financial %',        defaultOn: true },
      { key: 'financialUtilisationPct',  label: 'Financial Utilisation %', defaultOn: true },
    ],
  },
  {
    group: 'Financial Totals',
    fields: [
      { key: 'totalAaCr',        label: 'Total Sanctioned (₹ Cr)', defaultOn: false },
      { key: 'totalFinancialCr', label: 'Total Spent (₹ Cr)',      defaultOn: false },
    ],
  },
  {
    group: 'Additional Insight',
    fields: [
      { key: 'needsAttention', label: 'Needs-Attention List', defaultOn: false },
    ],
  },
];

const ALL_KPI_KEYS = KPI_GROUPS.flatMap((g) => g.fields.map((f) => f.key));
const DEFAULT_KPI_VIS = Object.fromEntries(
  KPI_GROUPS.flatMap((g) => g.fields.map((f) => [f.key, f.defaultOn])),
) as Record<KpiKey, boolean>;

// ── Right-side project-list column catalog ───────────────────────────────────
type ColKey =
  | 'projectName' | 'city' | 'district' | 'division' | 'region' | 'contractor' | 'pd' | 'sector' | 'schemes'
  | 'aaAmount' | 'agreementAmount' | 'physicalProgress'
  | 'financialProgressCr' | 'financialProgressPct'
  | 'expectedCompletion' | 'status' | 'contractType' | 'outstandingGap' | 'priority'
  | 'pbgAlert' | 'omStatus';

interface ColDef { key: ColKey; label: string; defaultOn: boolean; locked?: boolean }

const COLUMN_DEFS: ColDef[] = [
  { key: 'projectName',         label: 'Project Name',         defaultOn: true, locked: true },
  { key: 'city',                label: 'City',                 defaultOn: false },
  { key: 'district',            label: 'District',             defaultOn: true  },
  { key: 'division',            label: 'Division',             defaultOn: true  },
  { key: 'region',              label: 'Region',               defaultOn: false },
  { key: 'contractor',          label: 'Contractor',           defaultOn: false },
  { key: 'pd',                  label: 'PD',                   defaultOn: false },
  { key: 'sector',              label: 'Sector',               defaultOn: false },
  { key: 'schemes',             label: 'Scheme(s)',            defaultOn: false },
  { key: 'aaAmount',            label: 'AA Amount (₹ Cr)',      defaultOn: false },
  { key: 'agreementAmount',     label: 'Agreement Amount (₹ Cr)', defaultOn: false },
  { key: 'physicalProgress',    label: 'Physical %',           defaultOn: true  },
  { key: 'financialProgressCr', label: 'Financial (₹ Cr)',      defaultOn: false },
  { key: 'financialProgressPct',label: 'Financial %',          defaultOn: false },
  { key: 'expectedCompletion',  label: 'Expected Completion',   defaultOn: true  },
  { key: 'status',              label: 'Execution Status',      defaultOn: false },
  { key: 'contractType',        label: 'Contract Type',         defaultOn: false },
  { key: 'outstandingGap',      label: 'Outstanding Gap',       defaultOn: false },
  { key: 'priority',            label: 'Priority',              defaultOn: true  },
  { key: 'pbgAlert',            label: 'PBG Alert',             defaultOn: false },
  { key: 'omStatus',            label: 'O&M Status',            defaultOn: false },
];

const DEFAULT_COL_VIS = Object.fromEntries(
  COLUMN_DEFS.map((c) => [c.key, c.defaultOn]),
) as Record<ColKey, boolean>;

// ── Project-detail field catalog (per Enhance MD Portfolio Briefing spec §3) ─
// The 12 CORE fields are rendered in this exact order at the top when visible.
// Additional fields render below in group order.
type ProjectFieldKey =
  // Core (default ON) — order matters
  | 'nameOfWork' | 'agreementNumber' | 'agreementDate' | 'agreementAmount'
  | 'expectedCompletion' | 'physicalProgress' | 'financialProgress' | 'expenditureTillDate'
  | 'geotagPhotographs' | 'issuesRemarks' | 'agencyContractor' | 'pdName'
  // Extras (default OFF)
  | 'city' | 'district' | 'division' | 'region' | 'sector' | 'schemes' | 'projectStageV2' | 'contractType'
  | 'status' | 'priority'
  | 'sponsoringDept' | 'implementingAgency' | 'sanctionDate'
  | 'plannedEndDate' | 'revisedEndDate' | 'scheduledProgressPct'
  | 'delayReason' | 'deptStuckAt'
  | 'aaAmount' | 'revisedAaAmount' | 'contractValueCr'
  | 'mobAdvanceIssuedCr' | 'mobAdvanceRecoveredCr' | 'advanceOutstandingCr' | 'retentionMoneyHeldCr'
  | 'totalPaymentsCr' | 'lastPaymentDate' | 'lastRaBillNo'
  | 'pbgNumber' | 'pbgAmountCr' | 'pbgIssuingBank' | 'pbgExpiryDate'
  | 'emdAmountCr' | 'emdRefNumber' | 'emdDate'
  | 'omStartDate' | 'omEndDate' | 'omPeriodMonths' | 'omAgency' | 'omRemarks'
  | 'projectBrief' | 'mainComponentScope';

interface ProjectFieldDef { key: ProjectFieldKey; label: string; defaultOn: boolean }
interface ProjectFieldGroup { group: string; fields: ProjectFieldDef[] }

const PROJECT_FIELD_GROUPS: ProjectFieldGroup[] = [
  {
    group: 'Core',
    fields: [
      { key: 'nameOfWork',          label: 'Name of Work',                defaultOn: true },
      { key: 'agreementNumber',     label: 'Agreement Number',            defaultOn: true },
      { key: 'agreementDate',       label: 'Agreement Date',              defaultOn: true },
      { key: 'agreementAmount',     label: 'Agreement Amount',            defaultOn: true },
      { key: 'expectedCompletion',  label: 'Expected Date of Completion', defaultOn: true },
      { key: 'physicalProgress',    label: 'Physical Progress',           defaultOn: true },
      { key: 'financialProgress',   label: 'Financial Progress',          defaultOn: true },
      { key: 'expenditureTillDate', label: 'Expenditure Till Date',       defaultOn: true },
      { key: 'geotagPhotographs',   label: 'Geotag Photographs',          defaultOn: true },
      { key: 'issuesRemarks',       label: 'Issues and Remarks',          defaultOn: true },
      { key: 'agencyContractor',    label: 'Name of Agency / Contractor', defaultOn: true },
      { key: 'pdName',              label: 'Name of PD',                  defaultOn: true },
    ],
  },
  {
    group: 'Classification',
    fields: [
      { key: 'city',           label: 'City',           defaultOn: false },
      { key: 'district',       label: 'District',       defaultOn: false },
      { key: 'division',       label: 'Division',       defaultOn: false },
      { key: 'region',         label: 'Region',         defaultOn: false },
      { key: 'sector',         label: 'Sector',         defaultOn: false },
      { key: 'schemes',        label: 'Scheme(s)',      defaultOn: false },
      { key: 'projectStageV2', label: 'Project Stage',    defaultOn: false },
      { key: 'contractType',   label: 'Contract Type',    defaultOn: false },
      { key: 'status',         label: 'Execution Status', defaultOn: false },
      { key: 'priority',       label: 'Priority',         defaultOn: false },
    ],
  },
  {
    group: 'Sponsoring & Dates',
    fields: [
      { key: 'sponsoringDept',       label: 'Sponsoring Department', defaultOn: false },
      { key: 'implementingAgency',   label: 'Implementing Agency',   defaultOn: false },
      { key: 'sanctionDate',         label: 'Sanction Date',         defaultOn: false },
      { key: 'plannedEndDate',       label: 'Planned End Date',      defaultOn: false },
      { key: 'revisedEndDate',       label: 'Revised End Date',      defaultOn: false },
      { key: 'scheduledProgressPct', label: 'Scheduled Progress %',  defaultOn: false },
      { key: 'delayReason',          label: 'Delay Reason',          defaultOn: false },
      { key: 'deptStuckAt',          label: 'Department Stuck At',   defaultOn: false },
    ],
  },
  {
    group: 'Contract & Financial',
    fields: [
      { key: 'aaAmount',              label: 'AA Amount',             defaultOn: false },
      { key: 'revisedAaAmount',       label: 'Revised AA Amount',     defaultOn: false },
      { key: 'contractValueCr',       label: 'Contract Value',        defaultOn: false },
      { key: 'mobAdvanceIssuedCr',    label: 'Mob. Advance Issued',   defaultOn: false },
      { key: 'mobAdvanceRecoveredCr', label: 'Mob. Advance Recovered', defaultOn: false },
      { key: 'advanceOutstandingCr',  label: 'Advance Outstanding',   defaultOn: false },
      { key: 'retentionMoneyHeldCr',  label: 'Retention Held',        defaultOn: false },
      { key: 'totalPaymentsCr',       label: 'Total Payments',        defaultOn: false },
      { key: 'lastPaymentDate',       label: 'Last Payment Date',     defaultOn: false },
      { key: 'lastRaBillNo',          label: 'Last RA Bill No.',       defaultOn: false },
    ],
  },
  {
    group: 'Security & Guarantees',
    fields: [
      { key: 'pbgNumber',      label: 'PBG Number',       defaultOn: false },
      { key: 'pbgAmountCr',    label: 'PBG Amount',       defaultOn: false },
      { key: 'pbgIssuingBank', label: 'PBG Issuing Bank', defaultOn: false },
      { key: 'pbgExpiryDate',  label: 'PBG Expiry Date',  defaultOn: false },
      { key: 'emdAmountCr',    label: 'EMD Amount',       defaultOn: false },
      { key: 'emdRefNumber',   label: 'EMD Reference',    defaultOn: false },
      { key: 'emdDate',        label: 'EMD Date',         defaultOn: false },
    ],
  },
  {
    group: 'O&M',
    fields: [
      { key: 'omStartDate',    label: 'O&M Start Date',      defaultOn: false },
      { key: 'omEndDate',      label: 'O&M End Date',        defaultOn: false },
      { key: 'omPeriodMonths', label: 'O&M Period (months)', defaultOn: false },
      { key: 'omAgency',       label: 'O&M Agency',          defaultOn: false },
      { key: 'omRemarks',      label: 'O&M Remarks',         defaultOn: false },
    ],
  },
  {
    group: 'Notes',
    fields: [
      { key: 'projectBrief',       label: 'Project Brief',          defaultOn: false },
      { key: 'mainComponentScope', label: 'Main Component / Scope', defaultOn: false },
    ],
  },
];

const ALL_PROJECT_KEYS = PROJECT_FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.key));
const DEFAULT_PROJECT_VIS = Object.fromEntries(
  PROJECT_FIELD_GROUPS.flatMap((g) => g.fields.map((f) => [f.key, f.defaultOn])),
) as Record<ProjectFieldKey, boolean>;
/** Fixed render order: 12 core fields as specified, then extras in group order. */
const PROJECT_FIELD_ORDER: ProjectFieldKey[] = ALL_PROJECT_KEYS;

// ── localStorage helpers (buidco_md_popup_*_v1 per spec §7) ──────────────────
const LS_KPI_KEY  = 'buidco_md_popup_left_fields_v1';
const LS_COLS_KEY = 'buidco_md_popup_right_columns_v1';
const LS_PROJ_KEY = 'buidco_md_popup_project_fields_v1';

function loadVis<K extends string>(
  storageKey: string,
  defaults: Record<K, boolean>,
): Record<K, boolean> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { ...defaults };
    return { ...defaults, ...(JSON.parse(raw) as Partial<Record<K, boolean>>) };
  } catch {
    return { ...defaults };
  }
}
function saveVis<K extends string>(storageKey: string, v: Record<K, boolean>): void {
  try { localStorage.setItem(storageKey, JSON.stringify(v)); } catch { /* quota */ }
}

// ── Props ────────────────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onClose: () => void;
}

// ── Main component ───────────────────────────────────────────────────────────
export function MdSchemeSummaryModal({ open, onClose }: Props): JSX.Element | null {
  const kpiQuery      = useGetSchemeKpiSummaryQuery(undefined, { skip: !open });
  const lookupsQuery  = useGetLookupsQuery(undefined, { skip: !open });

  const [activeSchemeId, setActiveSchemeId]   = useState<number | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [openPicker, setOpenPicker]           = useState<null | 'kpi' | 'cols' | 'proj'>(null);
  const [colSearch, setColSearch]             = useState('');
  const [kpiSearch, setKpiSearch]             = useState('');
  const [projSearch, setProjSearch]           = useState('');
  const [kpiVis, setKpiVis]                   = useState<Record<KpiKey, boolean>>(() =>
    loadVis(LS_KPI_KEY, DEFAULT_KPI_VIS),
  );
  const [colVis, setColVis]                   = useState<Record<ColKey, boolean>>(() =>
    loadVis(LS_COLS_KEY, DEFAULT_COL_VIS),
  );
  const [projVis, setProjVis]                 = useState<Record<ProjectFieldKey, boolean>>(() =>
    loadVis(LS_PROJ_KEY, DEFAULT_PROJECT_VIS),
  );
  const searchRef = useRef<HTMLInputElement>(null);

  // Project list for the active scheme — fetched only when a scheme is picked.
  const projectsQuery = useListProjectsQuery(
    activeSchemeId ? { schemeId: activeSchemeId, limit: 100 } : { limit: 1 },
    { skip: !open || activeSchemeId === null },
  );

  // Delay status — only fetched when the Needs-Attention insight is on AND a
  // scheme is active, to keep the popup cheap on first open.
  const delayQuery = useGetDelayStatusQuery(undefined, {
    skip: !open || activeSchemeId === null || !kpiVis.needsAttention,
  });

  // Full ProjectDetail — needed for core fields (Name of Work, Agreement Number,
  // Agreement Date) that aren't on the light ProjectListItem.
  const projectDetailQuery = useGetProjectQuery(activeProjectId ?? '', {
    skip: !open || activeProjectId === null,
  });

  // ── Escape → picker → project → modal ──
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      if (openPicker)      { setOpenPicker(null);     return; }
      if (activeProjectId) { setActiveProjectId(null); return; }
      onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, openPicker, activeProjectId, onClose]);

  // Switching scheme clears any drilled-in project.
  useEffect(() => {
    setActiveProjectId(null);
  }, [activeSchemeId]);

  // ── Body scroll lock while modal is open ──
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // ── Focus picker search when picker opens ──
  useEffect(() => {
    if (openPicker) setTimeout(() => searchRef.current?.focus(), 60);
  }, [openPicker]);

  // ── Derived state ──
  const schemes = kpiQuery.data?.items ?? [];
  const active  = activeSchemeId ? schemes.find((s) => s.schemeId === activeSchemeId) ?? null : null;

  const projects = projectsQuery.data?.items ?? [];
  const activeProject = activeProjectId
    ? projects.find((p) => p.projectId === activeProjectId) ?? null
    : null;

  const districtsById = useMemo(() => {
    const m = new Map<number, string>();
    for (const d of lookupsQuery.data?.districts ?? []) m.set(d.districtId, d.districtName);
    return m;
  }, [lookupsQuery.data]);
  const sectorsById = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of lookupsQuery.data?.sectors ?? []) m.set(s.sectorId, s.sectorName);
    return m;
  }, [lookupsQuery.data]);
  const schemesById = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of lookupsQuery.data?.schemes ?? []) m.set(s.schemeId, s.schemeName);
    return m;
  }, [lookupsQuery.data]);
  const divisionsById = useMemo(() => {
    const regionById = new Map(
      (lookupsQuery.data?.regions ?? []).map((r) => [r.regionId, r.regionName]),
    );
    const m = new Map<number, { name: string; regionName: string }>();
    for (const d of lookupsQuery.data?.divisions ?? []) {
      m.set(d.divisionId, { name: d.divisionName, regionName: regionById.get(d.regionId) ?? '' });
    }
    return m;
  }, [lookupsQuery.data]);

  // Sort projects: High priority first, then Delayed first, then nearest expected date
  const sortedProjects = useMemo(() => {
    const priorityWeight = (p: string | null): number =>
      p === 'High' ? 0 : p === 'Medium' ? 1 : p === 'Low' ? 2 : 3;
    const statusWeight = (s: string | null): number =>
      s === 'Delayed' ? 0 : s === 'In Progress' ? 1 : s === 'On Hold' ? 2 :
      s === 'Not Started' ? 3 : s === 'Completed' ? 4 : 5;
    return [...projects].sort((a, b) => {
      const pd = priorityWeight(a.priority) - priorityWeight(b.priority);
      if (pd !== 0) return pd;
      const sd = statusWeight(a.status) - statusWeight(b.status);
      if (sd !== 0) return sd;
      const ax = a.expectedCompletionDate ?? '9999-12-31';
      const bx = b.expectedCompletionDate ?? '9999-12-31';
      return ax.localeCompare(bx);
    });
  }, [projects]);

  const needsAttentionList = useMemo(() => {
    if (!kpiVis.needsAttention || activeSchemeId === null) return [];
    const schemeProjectIds = new Set(projects.map((p) => p.projectId));
    const delayed = (delayQuery.data?.items ?? [])
      .filter((d) => schemeProjectIds.has(d.projectId))
      .filter((d) => (d.uncoveredDelayDays ?? 0) > 0)
      .sort((a, b) => (b.uncoveredDelayDays ?? 0) - (a.uncoveredDelayDays ?? 0));
    if (delayed.length >= 3) return delayed.slice(0, 3);
    const highPri = projects
      .filter((p) => p.priority === 'High' && !delayed.some((d) => d.projectId === p.projectId))
      .map((p) => ({
        projectId: p.projectId,
        projectName: p.projectName,
        uncoveredDelayDays: null as number | null,
      }));
    const combined = [
      ...delayed.map((d) => ({
        projectId: d.projectId,
        projectName: d.projectName ?? '—',
        uncoveredDelayDays: d.uncoveredDelayDays,
      })),
      ...highPri,
    ];
    return combined.slice(0, 3);
  }, [kpiVis.needsAttention, activeSchemeId, projects, delayQuery.data]);

  // Picker filtering
  const filteredKpiGroups = KPI_GROUPS
    .map((g) => ({
      ...g,
      fields: g.fields.filter(
        (f) => !kpiSearch || f.label.toLowerCase().includes(kpiSearch.toLowerCase()),
      ),
    }))
    .filter((g) => g.fields.length > 0);

  const filteredCols = COLUMN_DEFS.filter(
    (c) => !colSearch || c.label.toLowerCase().includes(colSearch.toLowerCase()),
  );

  const filteredProjGroups = PROJECT_FIELD_GROUPS
    .map((g) => ({
      ...g,
      fields: g.fields.filter(
        (f) => !projSearch || f.label.toLowerCase().includes(projSearch.toLowerCase()),
      ),
    }))
    .filter((g) => g.fields.length > 0);

  // Visible column list (order preserved, projectName always first)
  const visibleCols = COLUMN_DEFS.filter((c) => c.locked || colVis[c.key]);

  // Any visible left field?
  const anyKpiOn = ALL_KPI_KEYS.some((k) => kpiVis[k]);

  const toggleKpi = (k: KpiKey): void => {
    setKpiVis((prev) => {
      const next = { ...prev, [k]: !prev[k] };
      saveVis(LS_KPI_KEY, next);
      return next;
    });
  };
  const toggleCol = (k: ColKey): void => {
    setColVis((prev) => {
      const next = { ...prev, [k]: !prev[k] };
      saveVis(LS_COLS_KEY, next);
      return next;
    });
  };
  const setAllKpi = (v: boolean): void => {
    const next = Object.fromEntries(ALL_KPI_KEYS.map((k) => [k, v])) as Record<KpiKey, boolean>;
    setKpiVis(next); saveVis(LS_KPI_KEY, next);
  };
  const setAllCols = (v: boolean): void => {
    const next = Object.fromEntries(
      COLUMN_DEFS.map((c) => [c.key, c.locked ? true : v]),
    ) as Record<ColKey, boolean>;
    setColVis(next); saveVis(LS_COLS_KEY, next);
  };
  const toggleProj = (k: ProjectFieldKey): void => {
    setProjVis((prev) => {
      const next = { ...prev, [k]: !prev[k] };
      saveVis(LS_PROJ_KEY, next);
      return next;
    });
  };
  const setAllProj = (v: boolean): void => {
    const next = Object.fromEntries(ALL_PROJECT_KEYS.map((k) => [k, v])) as Record<ProjectFieldKey, boolean>;
    setProjVis(next); saveVis(LS_PROJ_KEY, next);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="MD Scheme Summary"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="relative flex flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-2xl"
        style={{ width: '95vw', maxWidth: '1800px', height: 'min(92vh, 1000px)' }}
      >
        {/* ── Gradient header (matches ProjectProfileModal) ────────────── */}
        <header
          className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-5 py-3"
          style={{ background: 'linear-gradient(100deg,#1E3A5F 0%,#2563EB 100%)' }}
        >
          <div className="min-w-0">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#93C5FD]">
              📊 MD Portfolio Briefing
            </p>
            <h2 className="mt-0.5 text-[15px] font-bold text-white">Scheme Summary</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onClose}
              aria-label="Close"
              className="border-white/40 bg-white/15 text-white hover:bg-white/25"
            >
              ✕
            </Button>
          </div>
        </header>

        {/* ── Body: two panels — each is its own contained scroll area ─── */}
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,_5fr)_minmax(0,_7fr)]">
          {/* LEFT — KPI Summary OR active-project details */}
          <section className="flex min-h-0 min-w-0 flex-col border-b border-[#E5E7EB] lg:border-b-0 lg:border-r">
            <div className="flex shrink-0 items-center justify-between border-b border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5">
              <span className="truncate text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                {activeProject ? 'Project Snapshot' : 'Scheme KPIs'}
              </span>
              <div className="flex shrink-0 items-center gap-1.5">
                {activeProject ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveProjectId(null)}
                      className="rounded-md border border-[#D1D5DB] bg-white px-2 py-1 text-[10.5px] font-semibold text-[#374151] hover:bg-[#F3F4F6]"
                    >
                      ← Back to KPIs
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenPicker(openPicker === 'proj' ? null : 'proj')}
                      title="Customise project detail fields"
                      aria-pressed={openPicker === 'proj'}
                      className={cn(
                        'rounded-md border px-2 py-1 text-[10.5px] font-semibold transition-colors',
                        openPicker === 'proj'
                          ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white'
                          : 'border-[#D1D5DB] bg-white text-[#374151] hover:bg-[#F3F4F6]',
                      )}
                    >
                      ⚙️ Fields
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpenPicker(openPicker === 'kpi' ? null : 'kpi')}
                    title="Customise KPI fields"
                    aria-pressed={openPicker === 'kpi'}
                    className={cn(
                      'rounded-md border px-2 py-1 text-[10.5px] font-semibold transition-colors',
                      openPicker === 'kpi'
                        ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white'
                        : 'border-[#D1D5DB] bg-white text-[#374151] hover:bg-[#F3F4F6]',
                    )}
                  >
                    ⚙️ Fields
                  </button>
                )}
              </div>
            </div>

            {openPicker === 'kpi' && !activeProject ? (
              <FieldPickerPanel
                title="Customise KPI Fields"
                searchValue={kpiSearch}
                onSearch={setKpiSearch}
                searchRef={searchRef}
                onShowAll={() => setAllKpi(true)}
                onHideAll={() => setAllKpi(false)}
                onDone={() => { setOpenPicker(null); setKpiSearch(''); }}
                renderBody={() =>
                  filteredKpiGroups.length === 0 ? (
                    <p className="text-[12px] text-[#9CA3AF]">No fields match.</p>
                  ) : (
                    <div className="space-y-3">
                      {filteredKpiGroups.map((g) => (
                        <div key={g.group}>
                          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">
                            {g.group}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {g.fields.map((f) => (
                              <Pill
                                key={f.key}
                                on={kpiVis[f.key]}
                                onToggle={() => toggleKpi(f.key)}
                                label={f.label}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                }
              />
            ) : null}

            {openPicker === 'proj' && activeProject ? (
              <FieldPickerPanel
                title="Customise Project Detail Fields"
                searchValue={projSearch}
                onSearch={setProjSearch}
                searchRef={searchRef}
                onShowAll={() => setAllProj(true)}
                onHideAll={() => setAllProj(false)}
                onDone={() => { setOpenPicker(null); setProjSearch(''); }}
                renderBody={() =>
                  filteredProjGroups.length === 0 ? (
                    <p className="text-[12px] text-[#9CA3AF]">No fields match.</p>
                  ) : (
                    <div className="space-y-3">
                      {filteredProjGroups.map((g) => (
                        <div key={g.group}>
                          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">
                            {g.group}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {g.fields.map((f) => (
                              <Pill
                                key={f.key}
                                on={projVis[f.key]}
                                onToggle={() => toggleProj(f.key)}
                                label={f.label}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                }
              />
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {activeProject ? (
                <ProjectDetailsBody
                  listItem={activeProject}
                  detail={projectDetailQuery.data ?? null}
                  detailLoading={projectDetailQuery.isLoading}
                  vis={projVis}
                  districtsById={districtsById}
                  divisionsById={divisionsById}
                  sectorsById={sectorsById}
                  schemesById={schemesById}
                />
              ) : activeSchemeId === null ? (
                <EmptyPanelState
                  icon="👉"
                  title="Select a scheme"
                  hint="Pick any scheme on the right to see its portfolio KPIs here."
                />
              ) : kpiQuery.isLoading || !active ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : !anyKpiOn ? (
                <EmptyPanelState
                  icon="⚙️"
                  title="No KPI fields visible"
                  hint="Open the Fields picker above and turn some on."
                />
              ) : (
                <SchemeKpiBody
                  active={active}
                  vis={kpiVis}
                  needsAttentionList={needsAttentionList}
                  needsAttentionLoading={
                    kpiVis.needsAttention && (projectsQuery.isLoading || delayQuery.isLoading)
                  }
                />
              )}
            </div>
          </section>

          {/* RIGHT — Scheme selector (fixed) + project list (scrolls) */}
          <section className="flex min-h-0 min-w-0 flex-col">
            <div className="flex shrink-0 items-center justify-between border-b border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5">
              <span className="truncate text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                Schemes {schemes.length ? `· ${schemes.length}` : ''}
              </span>
              <button
                type="button"
                onClick={() => setOpenPicker(openPicker === 'cols' ? null : 'cols')}
                title="Customise columns"
                aria-pressed={openPicker === 'cols'}
                className={cn(
                  'shrink-0 rounded-md border px-2 py-1 text-[10.5px] font-semibold transition-colors',
                  openPicker === 'cols'
                    ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white'
                    : 'border-[#D1D5DB] bg-white text-[#374151] hover:bg-[#F3F4F6]',
                )}
              >
                ☰ Columns
              </button>
            </div>

            {openPicker === 'cols' ? (
              <FieldPickerPanel
                title="Customise Project Columns"
                searchValue={colSearch}
                onSearch={setColSearch}
                searchRef={searchRef}
                onShowAll={() => setAllCols(true)}
                onHideAll={() => setAllCols(false)}
                onDone={() => { setOpenPicker(null); setColSearch(''); }}
                renderBody={() =>
                  filteredCols.length === 0 ? (
                    <p className="text-[12px] text-[#9CA3AF]">No columns match.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {filteredCols.map((c) => (
                        <Pill
                          key={c.key}
                          on={c.locked ? true : colVis[c.key]}
                          onToggle={() => c.locked ? undefined : toggleCol(c.key)}
                          label={c.label}
                          locked={c.locked}
                        />
                      ))}
                    </div>
                  )
                }
              />
            ) : null}

            {/* Scheme chip grid — fixed above scroll */}
            <div className="shrink-0 border-b border-[#E5E7EB] px-4 py-3">
              {kpiQuery.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : schemes.length === 0 ? (
                <p className="text-[12px] text-[#6B7280]">No schemes configured.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {schemes.map((s, idx) => (
                    <SchemeChip
                      key={s.schemeId}
                      name={s.schemeName}
                      total={s.total}
                      color={SCHEME_COLORS[idx % SCHEME_COLORS.length] ?? '#1E3A5F'}
                      active={activeSchemeId === s.schemeId}
                      onClick={() =>
                        setActiveSchemeId(activeSchemeId === s.schemeId ? null : s.schemeId)
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Project list for active scheme — scrolls both axes inside */}
            <div className="min-h-0 flex-1 overflow-auto p-3">
              {activeSchemeId === null ? (
                <EmptyPanelState
                  icon="⬆️"
                  title="Select a scheme above"
                  hint="Its project list will appear here."
                />
              ) : projectsQuery.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : sortedProjects.length === 0 ? (
                <EmptyPanelState
                  icon="📄"
                  title="No projects"
                  hint="This scheme has no projects yet."
                />
              ) : (
                <ProjectList
                  projects={sortedProjects}
                  columns={visibleCols}
                  activeProjectId={activeProjectId}
                  onSelect={setActiveProjectId}
                  districtsById={districtsById}
                  divisionsById={divisionsById}
                  sectorsById={sectorsById}
                  schemesById={schemesById}
                />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ── LEFT panel body ──────────────────────────────────────────────────────────
function SchemeKpiBody({
  active, vis, needsAttentionList, needsAttentionLoading,
}: {
  active: SchemeKpiSummaryRow;
  vis: Record<KpiKey, boolean>;
  needsAttentionList: Array<{ projectId: string; projectName: string; uncoveredDelayDays: number | null }>;
  needsAttentionLoading: boolean;
}): JSX.Element {
  const statusKeys: Array<{ k: KpiKey; label: string; value: number; tone: string }> = [
    { k: 'total',      label: 'Total',       value: active.total,      tone: 'brand'   },
    { k: 'completed',  label: 'Completed',   value: active.completed,  tone: 'success' },
    { k: 'inProgress', label: 'In Progress', value: active.inProgress, tone: 'info'    },
    { k: 'delayed',    label: 'Delayed',     value: active.delayed,    tone: 'danger'  },
    { k: 'onHold',     label: 'On Hold',     value: active.onHold,     tone: 'muted'   },
    { k: 'notStarted', label: 'Not Started', value: active.notStarted, tone: 'amber'   },
  ];
  const visibleStatuses = statusKeys.filter((s) => vis[s.k]);

  const showProgress =
    vis.avgPhysicalPct || vis.avgFinancialPct || vis.financialUtilisationPct;
  const showFinancial =
    vis.totalAaCr || vis.totalFinancialCr;

  return (
    <div className="space-y-4">
      {/* Scheme name header (fixed chrome — always shown) */}
      <div>
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">
          Active Scheme
        </p>
        <h3 className="text-[15px] font-bold text-[#111827]">{active.schemeName}</h3>
      </div>

      {/* Status Breakdown */}
      {visibleStatuses.length > 0 ? (
        <div className={cn(
          'grid gap-2',
          visibleStatuses.length <= 2 ? 'grid-cols-2' :
          visibleStatuses.length === 3 ? 'grid-cols-3' :
          'grid-cols-2 sm:grid-cols-3',
        )}>
          {visibleStatuses.map((s) => (
            <StatusKpi key={s.k} label={s.label} value={s.value} tone={s.tone as KpiTone} />
          ))}
        </div>
      ) : null}

      {/* Progress Metrics */}
      {showProgress ? (
        <div className="space-y-2 rounded-lg border border-[#E5E7EB] bg-white p-3 shadow-sm">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">
            Progress Metrics
          </p>
          {vis.avgPhysicalPct ? (
            <ProgressRow label="Avg Physical" value={active.avgPhysicalPct} color="#1D4ED8" />
          ) : null}
          {vis.avgFinancialPct ? (
            <ProgressRow label="Avg Financial" value={active.avgFinancialPct} color="#22C55E" />
          ) : null}
          {vis.financialUtilisationPct ? (
            <ProgressRow label="Financial Utilisation" value={active.financialUtilisationPct} color="#F59E0B" />
          ) : null}
        </div>
      ) : null}

      {/* Financial Totals */}
      {showFinancial ? (
        <div className="grid grid-cols-2 gap-2">
          {vis.totalAaCr ? (
            <MoneyKpi label="Total Sanctioned" value={active.totalAaCr} tone="brand" />
          ) : null}
          {vis.totalFinancialCr ? (
            <MoneyKpi label="Total Spent" value={active.totalFinancialCr} tone="success" />
          ) : null}
        </div>
      ) : null}

      {/* Needs-Attention list */}
      {vis.needsAttention ? (
        <div className="rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] p-3 shadow-sm">
          <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-[#B91C1C]">
            ⚠ Needs Attention (Top 3)
          </p>
          {needsAttentionLoading ? (
            <Skeleton className="h-14 w-full" />
          ) : needsAttentionList.length === 0 ? (
            <p className="text-[12px] text-[#6B7280]">Nothing critical right now.</p>
          ) : (
            <ul className="space-y-1.5 text-[12px]">
              {needsAttentionList.map((p) => (
                <li
                  key={p.projectId}
                  className="flex items-center justify-between rounded border border-[#FCA5A5] bg-white px-2 py-1.5"
                >
                  <span className="min-w-0 truncate font-semibold text-[#111827]">
                    {p.projectName}
                  </span>
                  <span className="ml-2 shrink-0 text-[11px] font-bold text-[#B91C1C]">
                    {p.uncoveredDelayDays !== null && p.uncoveredDelayDays > 0
                      ? `${p.uncoveredDelayDays}d late`
                      : 'High priority'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── RIGHT panel: project table ───────────────────────────────────────────────
function ProjectList({
  projects, columns, activeProjectId, onSelect,
  districtsById, divisionsById, sectorsById, schemesById,
}: {
  projects: ProjectListItem[];
  columns: ColDef[];
  activeProjectId: string | null;
  onSelect: (id: string) => void;
  districtsById: Map<number, string>;
  divisionsById: Map<number, { name: string; regionName: string }>;
  sectorsById: Map<number, string>;
  schemesById: Map<number, string>;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white shadow-sm">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-[#F9FAFB] text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">
            {columns.map((c) => (
              <th key={c.key} className="whitespace-nowrap px-3 py-2 text-left">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.map((p, idx) => {
            const isActive = p.projectId === activeProjectId;
            return (
              <tr
                key={p.projectId}
                role="button"
                tabIndex={0}
                aria-selected={isActive}
                onClick={() => onSelect(p.projectId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(p.projectId);
                  }
                }}
                className={cn(
                  'cursor-pointer border-b border-[#F3F4F6] transition-colors focus:outline-none',
                  isActive
                    ? 'bg-[#EFF6FF] ring-1 ring-inset ring-[#93C5FD]'
                    : cn(
                        'hover:bg-[#F0F7FF] focus:bg-[#EFF6FF]',
                        idx % 2 === 1 && 'bg-[#FAFAFA]',
                      ),
                )}
              >
                {columns.map((c) => (
                  <td key={c.key} className="px-3 py-2 align-middle">
                    {renderCell(c.key, p, districtsById, divisionsById, sectorsById, schemesById)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── LEFT panel: customizable project details ────────────────────────────────
// Renders every visible field in PROJECT_FIELD_ORDER — the 12 spec-mandated
// core fields first (in their exact order), then extras. Falls back to the
// list item's data while the full ProjectDetail is still loading, so the panel
// paints instantly on click.
function ProjectDetailsBody({
  listItem, detail, detailLoading, vis,
  districtsById, divisionsById, sectorsById, schemesById,
}: {
  listItem: ProjectListItem;
  detail: ProjectDetail | null;
  detailLoading: boolean;
  vis: Record<ProjectFieldKey, boolean>;
  districtsById: Map<number, string>;
  divisionsById: Map<number, { name: string; regionName: string }>;
  sectorsById: Map<number, string>;
  schemesById: Map<number, string>;
}): JSX.Element {
  const p = detail ?? listItem;                            // prefer full detail
  const asDetail = detail as ProjectDetail | null;         // extra fields

  const districtName = p.districtId ? districtsById.get(p.districtId) ?? null : null;
  const divisionRow  = p.divisionId ? divisionsById.get(p.divisionId) ?? null : null;
  const divisionName = divisionRow?.name ?? null;
  const regionName   = divisionRow?.regionName ?? null;
  const sectorName   = p.sectorId   ? sectorsById.get(p.sectorId)     ?? null : null;
  const schemeNames  = p.schemes.map((id) => schemesById.get(id) ?? `#${id}`);

  const renderField = (key: ProjectFieldKey): FieldOutput | null => {
    switch (key) {
      case 'nameOfWork':
        return {
          label: 'Name of Work',
          value: asDetail?.mainWork ?? (detailLoading ? 'Loading…' : '—'),
          fullWidth: true,
          preserveNewlines: true,
        };
      case 'agreementNumber':
        return { label: 'Agreement Number', value: asDetail?.agreementNumber ?? (detailLoading ? '…' : '—') };
      case 'agreementDate':
        return { label: 'Agreement Date', value: formatDate(asDetail?.agreementDate) };
      case 'agreementAmount':
        return { label: 'Agreement Amount', value: formatCurrencyCr(p.agreementAmountCr), tone: 'strong' };
      case 'expectedCompletion': {
        const d = formatDate(p.expectedCompletionDate);
        return { label: 'Expected Date of Completion', value: d === '—' ? (p.expectedCompletionRaw ?? '—') : d };
      }
      case 'physicalProgress':
        return { label: 'Physical Progress', value: <ProgressCell value={p.effectivePhysicalPct} color="#1D4ED8" /> };
      case 'financialProgress':
        return { label: 'Financial Progress', value: <ProgressCell value={p.financialProgressPct} color="#22C55E" /> };
      case 'expenditureTillDate':
        return { label: 'Expenditure Till Date', value: formatCurrencyCr(p.financialProgressCr), tone: 'strong' };
      case 'geotagPhotographs':
        return {
          label: 'Geotag Photographs',
          value: <span className="italic text-[#6B7280]">— photos view is deferred</span>,
        };
      case 'issuesRemarks':
        return {
          label: 'Issues and Remarks',
          value: p.remark ?? '—',
          fullWidth: true,
          preserveNewlines: true,
          tone: p.remark ? 'warn' : undefined,
        };
      case 'agencyContractor':
        return { label: 'Name of Agency / Contractor', value: p.contractor ?? '—' };
      case 'pdName':
        return { label: 'Name of PD', value: p.pd ?? '—' };

      case 'city':                return { label: 'City',                 value: p.city ?? '—' };
      case 'district':            return { label: 'District',             value: districtName ?? '—' };
      case 'division':            return { label: 'Division',             value: divisionName ?? '—' };
      case 'region':              return { label: 'Region',               value: regionName ?? '—' };
      case 'sector':              return { label: 'Sector',               value: sectorName ?? '—' };
      case 'schemes':             return { label: 'Scheme(s)',            value: schemeNames.length ? schemeNames.join(', ') : '—' };
      case 'projectStageV2':      return { label: 'Project Stage',        value: p.projectStageV2 ?? '—' };
      case 'contractType':        return { label: 'Contract Type',        value: p.contractType ?? '—' };
      case 'status':              return { label: 'Execution Status',     value: <StatusBadge status={p.status} /> };
      case 'priority':            return { label: 'Priority',             value: <PriorityBadge priority={p.priority} /> };

      case 'sponsoringDept':      return { label: 'Sponsoring Department',value: asDetail?.sponsoringDept ?? '—' };
      case 'implementingAgency':  return { label: 'Implementing Agency',  value: asDetail?.implementingAgency ?? '—' };
      case 'sanctionDate':        return { label: 'Sanction Date',        value: formatDate(asDetail?.sanctionDate) };
      case 'plannedEndDate':      return { label: 'Planned End Date',     value: formatDate(p.plannedEndDate) };
      case 'revisedEndDate':      return { label: 'Revised End Date',     value: formatDate(p.revisedEndDate) };
      case 'scheduledProgressPct':return { label: 'Scheduled Progress %', value: formatPercent(asDetail?.scheduledProgressPct) };
      case 'delayReason':         return { label: 'Delay Reason',         value: asDetail?.delayReason ?? '—', fullWidth: true, preserveNewlines: true };
      case 'deptStuckAt':         return { label: 'Department Stuck At',  value: asDetail?.deptStuckAt ?? '—' };

      case 'aaAmount':              return { label: 'AA Amount',             value: formatCurrencyCr(p.aaAmountCr) };
      case 'revisedAaAmount':       return { label: 'Revised AA Amount',     value: formatCurrencyCr(p.revisedAaAmountCr) };
      case 'contractValueCr':       return { label: 'Contract Value',        value: formatCurrencyCr(asDetail?.contractValueCr) };
      case 'mobAdvanceIssuedCr':    return { label: 'Mob. Advance Issued',   value: formatCurrencyCr(asDetail?.mobAdvanceIssuedCr) };
      case 'mobAdvanceRecoveredCr': return { label: 'Mob. Advance Recovered', value: formatCurrencyCr(asDetail?.mobAdvanceRecoveredCr) };
      case 'advanceOutstandingCr':  return { label: 'Advance Outstanding',   value: formatCurrencyCr(asDetail?.advanceOutstandingCr) };
      case 'retentionMoneyHeldCr':  return { label: 'Retention Held',        value: formatCurrencyCr(asDetail?.retentionMoneyHeldCr) };
      case 'totalPaymentsCr':       return { label: 'Total Payments',        value: formatCurrencyCr(asDetail?.totalPaymentsCr) };
      case 'lastPaymentDate':       return { label: 'Last Payment Date',     value: formatDate(asDetail?.lastPaymentDate) };
      case 'lastRaBillNo':          return { label: 'Last RA Bill No.',       value: asDetail?.lastRaBillNo ?? '—' };

      case 'pbgNumber':      return { label: 'PBG Number',       value: asDetail?.pbgNumber ?? '—' };
      case 'pbgAmountCr':    return { label: 'PBG Amount',       value: formatCurrencyCr(asDetail?.pbgAmountCr) };
      case 'pbgIssuingBank': return { label: 'PBG Issuing Bank', value: asDetail?.pbgIssuingBank ?? '—' };
      case 'pbgExpiryDate':  return { label: 'PBG Expiry Date',  value: formatDate(p.pbgExpiryDate) };
      case 'emdAmountCr':    return { label: 'EMD Amount',       value: formatCurrencyCr(asDetail?.emdAmountCr) };
      case 'emdRefNumber':   return { label: 'EMD Reference',    value: asDetail?.emdRefNumber ?? '—' };
      case 'emdDate':        return { label: 'EMD Date',         value: formatDate(asDetail?.emdDate) };

      case 'omStartDate':    return { label: 'O&M Start Date',      value: formatDate(p.omStartDate) };
      case 'omEndDate':      return { label: 'O&M End Date',        value: formatDate(p.omEndDate) };
      case 'omPeriodMonths': return { label: 'O&M Period (months)', value: p.omPeriodMonths != null ? String(p.omPeriodMonths) : '—' };
      case 'omAgency':       return { label: 'O&M Agency',          value: asDetail?.omAgency ?? '—' };
      case 'omRemarks':      return { label: 'O&M Remarks',         value: asDetail?.omRemarks ?? '—', fullWidth: true, preserveNewlines: true };

      case 'projectBrief':       return { label: 'Project Brief',          value: asDetail?.projectBrief ?? '—', fullWidth: true, preserveNewlines: true };
      case 'mainComponentScope': return { label: 'Main Component / Scope', value: asDetail?.mainComponentScope ?? '—', fullWidth: true, preserveNewlines: true };
    }
  };

  const visibleFields = PROJECT_FIELD_ORDER
    .filter((k) => vis[k])
    .map((k) => ({ key: k, out: renderField(k) }))
    .filter((r): r is { key: ProjectFieldKey; out: FieldOutput } => r.out !== null);

  return (
    <div className="space-y-4">
      {/* Fixed chrome — project name + badges — always shown */}
      <div className="min-w-0">
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">
          Selected Project
        </p>
        <h3 className="mt-0.5 break-words text-[15px] font-bold text-[#111827]">
          {p.projectName}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={p.status} />
          <PriorityBadge priority={p.priority} />
        </div>
      </div>

      {visibleFields.length === 0 ? (
        <EmptyPanelState
          icon="⚙️"
          title="No project fields visible"
          hint="Open the Fields picker above and turn some on."
        />
      ) : (
        <div className="rounded-lg border border-[#E5E7EB] bg-white p-3 shadow-sm">
          <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">
            Project Details
          </p>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            {visibleFields.map(({ key, out }) => (
              <FieldRow key={key} field={out} />
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

interface FieldOutput {
  label: string;
  value: React.ReactNode;
  fullWidth?: boolean;
  preserveNewlines?: boolean;
  tone?: 'strong' | 'warn';
}

function FieldRow({ field }: { field: FieldOutput }): JSX.Element {
  const valueClass = cn(
    'text-[12.5px] leading-relaxed text-[#111827]',
    field.preserveNewlines && 'whitespace-pre-wrap break-words',
    field.tone === 'strong' && 'text-[14px] font-bold tabular-nums text-[#1E3A5F]',
    field.tone === 'warn'   && 'font-semibold text-[#B91C1C]',
  );
  return (
    <div className={cn('min-w-0', field.fullWidth && 'sm:col-span-2')}>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">
        {field.label}
      </dt>
      <dd className={valueClass}>{field.value}</dd>
    </div>
  );
}

function ProgressCell({ value, color }: { value: number | null | undefined; color: string }): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-[46px] text-[12.5px] font-bold tabular-nums text-[#111827]">
        {formatPercent(value)}
      </span>
      <div className="flex-1"><ProgressBar value={value} color={color} showLabel={false} /></div>
    </div>
  );
}

function renderCell(
  key: ColKey,
  p: ProjectListItem,
  districtsById: Map<number, string>,
  divisionsById: Map<number, { name: string; regionName: string }>,
  sectorsById: Map<number, string>,
  schemesById: Map<number, string>,
): React.ReactNode {
  switch (key) {
    case 'projectName':         return <span className="font-semibold text-[#1D4ED8]">{p.projectName}</span>;
    case 'city':                return <span className="text-[#374151]">{p.city ?? '—'}</span>;
    case 'district':            return <span className="text-[#374151]">{(p.districtId && districtsById.get(p.districtId)) ?? '—'}</span>;
    case 'division':            return <span className="text-[#374151]">{(p.divisionId && divisionsById.get(p.divisionId)?.name) ?? '—'}</span>;
    case 'region':              return <span className="text-[#374151]">{(p.divisionId && divisionsById.get(p.divisionId)?.regionName) ?? '—'}</span>;
    case 'contractor':          return <span className="text-[#374151]">{p.contractor ?? '—'}</span>;
    case 'pd':                  return <span className="text-[#374151]">{p.pd ?? '—'}</span>;
    case 'sector':              return <span className="text-[#374151]">{(p.sectorId && sectorsById.get(p.sectorId)) ?? '—'}</span>;
    case 'schemes': {
      const names = p.schemes.map((id) => schemesById.get(id) ?? `#${id}`);
      return <span className="text-[#374151]">{names.length ? names.join(', ') : '—'}</span>;
    }
    case 'aaAmount':            return <span className="tabular-nums text-[#111827]">{formatCurrencyCr(p.aaAmountCr)}</span>;
    case 'agreementAmount':     return <span className="tabular-nums text-[#111827]">{formatCurrencyCr(p.agreementAmountCr)}</span>;
    case 'physicalProgress':    return <ProgressBar value={p.effectivePhysicalPct} color="#3B82F6" />;
    case 'financialProgressCr': return <span className="tabular-nums text-[#111827]">{formatCurrencyCr(p.financialProgressCr)}</span>;
    case 'financialProgressPct':return <ProgressBar value={p.financialProgressPct} color="#22C55E" />;
    case 'expectedCompletion': {
      const d = formatDate(p.expectedCompletionDate);
      return <span className="tabular-nums text-[#374151]">{d === '—' ? (p.expectedCompletionRaw ?? '—') : d}</span>;
    }
    case 'status':              return <StatusBadge status={p.status} />;
    case 'contractType':        return <span className="text-[#374151]">{p.contractType ?? '—'}</span>;
    case 'outstandingGap':      return <span className="text-[12px] text-[#B91C1C]">{p.remark ?? '—'}</span>;
    case 'priority':            return <PriorityBadge priority={p.priority} />;
    case 'pbgAlert':            return <PbgAlertCell pbgExpiryDate={p.pbgExpiryDate} />;
    case 'omStatus':            return (
      <OmAlertCell
        status={p.status}
        omApplicable={p.omApplicable}
        omStartDate={p.omStartDate}
        omEndDate={p.omEndDate}
        omPeriodMonths={p.omPeriodMonths}
        omStatusOverride={p.omStatusOverride}
      />
    );
  }
}

// ── Sub-components ───────────────────────────────────────────────────────────
type KpiTone = 'brand' | 'success' | 'info' | 'danger' | 'muted' | 'amber';

function StatusKpi({ label, value, tone }: { label: string; value: number; tone: KpiTone }): JSX.Element {
  const palette: Record<KpiTone, { border: string; text: string; label: string }> = {
    brand:   { border: 'border-t-[#1E3A5F]', text: 'text-[#1E3A5F]', label: 'text-[#1E3A5F]' },
    success: { border: 'border-t-[#15803D]', text: 'text-[#15803D]', label: 'text-[#6B7280]' },
    info:    { border: 'border-t-[#1D4ED8]', text: 'text-[#1D4ED8]', label: 'text-[#6B7280]' },
    danger:  { border: 'border-t-[#B91C1C]', text: 'text-[#B91C1C]', label: 'text-[#6B7280]' },
    muted:   { border: 'border-t-[#9CA3AF]', text: 'text-[#374151]', label: 'text-[#6B7280]' },
    amber:   { border: 'border-t-[#B45309]', text: 'text-[#B45309]', label: 'text-[#6B7280]' },
  };
  const p = palette[tone];
  return (
    <div className={cn(
      'rounded border-x border-b border-[#E5E7EB] bg-white px-3 py-2 shadow-sm border-t-4',
      p.border,
    )}>
      <div className={cn('text-[10.5px] font-bold uppercase tracking-wider', p.label)}>{label}</div>
      <div className={cn('text-xl font-extrabold tabular-nums', p.text)}>{value}</div>
    </div>
  );
}

function MoneyKpi({ label, value, tone }: { label: string; value: number | null; tone: KpiTone }): JSX.Element {
  const palette: Record<KpiTone, string> = {
    brand:   'text-[#1E3A5F]',
    success: 'text-[#15803D]',
    info:    'text-[#1D4ED8]',
    danger:  'text-[#B91C1C]',
    muted:   'text-[#374151]',
    amber:   'text-[#B45309]',
  };
  return (
    <div className="rounded border border-[#E5E7EB] bg-white px-3 py-2 shadow-sm">
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">{label}</div>
      <div className={cn('mt-0.5 text-[15px] font-extrabold tabular-nums', palette[tone])}>
        {formatCurrencyCr(value)}
      </div>
    </div>
  );
}

function ProgressRow({ label, value, color }: {
  label: string; value: number | null; color: string;
}): JSX.Element {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[#374151]">{label}</span>
        <span className="text-[11px] font-bold tabular-nums text-[#111827]">{formatPercent(value)}</span>
      </div>
      <ProgressBar value={value} color={color} showLabel={false} />
    </div>
  );
}

function SchemeChip({ name, total, color, active, onClick }: {
  name: string; total: number; color: string; active: boolean; onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex flex-col items-start rounded-lg border p-2.5 text-left shadow-sm transition-all',
        active
          ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white'
          : 'border-[#E5E7EB] bg-white hover:-translate-y-0.5 hover:shadow-md',
      )}
    >
      <span
        className={cn(
          'text-[11.5px] font-bold leading-tight',
          active ? 'text-white' : 'text-[#111827]',
        )}
      >
        {name}
      </span>
      <span
        className={cn(
          'mt-0.5 text-[11px] font-semibold tabular-nums',
          active ? 'text-[#93C5FD]' : 'text-[#6B7280]',
        )}
        style={active ? undefined : { color }}
      >
        {total} project{total === 1 ? '' : 's'}
      </span>
    </button>
  );
}

function EmptyPanelState({ icon, title, hint }: {
  icon: string; title: string; hint: string;
}): JSX.Element {
  return (
    <div className="flex h-full min-h-[160px] flex-col items-center justify-center rounded-lg border border-dashed border-[#D1D5DB] bg-[#F9FAFB] p-6 text-center">
      <div className="text-2xl">{icon}</div>
      <p className="mt-2 text-[13px] font-bold text-[#374151]">{title}</p>
      <p className="mt-1 text-[11.5px] text-[#6B7280]">{hint}</p>
    </div>
  );
}

function Pill({ on, onToggle, label, locked }: {
  on: boolean;
  onToggle: () => void;
  label: string;
  locked?: boolean;
}): JSX.Element {
  return (
    <label
      className={cn(
        'flex select-none items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] transition-colors',
        locked
          ? 'cursor-not-allowed border-[#BFDBFE] bg-[#EFF6FF] font-semibold text-[#1E3A5F] opacity-90'
          : on
            ? 'cursor-pointer border-[#93C5FD] bg-[#EFF6FF] font-semibold text-[#1D4ED8]'
            : 'cursor-pointer border-[#E5E7EB] bg-[#F9FAFB] text-[#9CA3AF]',
      )}
    >
      <input
        type="checkbox"
        checked={on}
        disabled={locked}
        onChange={locked ? undefined : onToggle}
        className="cursor-pointer accent-[#1D4ED8] disabled:cursor-not-allowed"
      />
      {label}{locked ? ' 🔒' : ''}
    </label>
  );
}

function FieldPickerPanel({
  title, searchValue, onSearch, searchRef,
  onShowAll, onHideAll, onDone, renderBody,
}: {
  title: string;
  searchValue: string;
  onSearch: (v: string) => void;
  searchRef: React.RefObject<HTMLInputElement>;
  onShowAll: () => void;
  onHideAll: () => void;
  onDone: () => void;
  renderBody: () => React.ReactNode;
}): JSX.Element {
  return (
    <div className="border-b border-[#E5E7EB] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F3F4F6] px-4 py-2.5">
        <span className="text-[12px] font-bold text-[#1E3A5F]">⚙️ {title}</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onShowAll}
            className="rounded border border-[#D1D5DB] px-2.5 py-1 text-[10.5px] font-semibold text-[#374151] hover:bg-[#F9FAFB]"
          >Show All</button>
          <button
            type="button"
            onClick={onHideAll}
            className="rounded border border-[#FCA5A5] px-2.5 py-1 text-[10.5px] font-semibold text-[#B91C1C] hover:bg-[#FEF2F2]"
          >Hide All</button>
          <button
            type="button"
            onClick={onDone}
            className="rounded bg-[#1E3A5F] px-3 py-1 text-[10.5px] font-semibold text-white hover:bg-[#1e3a5fe0]"
          >Done ✓</button>
        </div>
      </div>
      <div className="px-4 pb-3 pt-2.5">
        <input
          ref={searchRef}
          value={searchValue}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search…"
          className="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-1.5 text-[12px] text-[#111827] outline-none placeholder:text-[#9CA3AF] focus:border-[#93C5FD] focus:ring-1 focus:ring-[#93C5FD]"
        />
      </div>
      <div className="max-h-64 overflow-y-auto px-4 pb-3">
        {renderBody()}
      </div>
    </div>
  );
}
