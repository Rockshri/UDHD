/**
 * KPI query layer — every dashboard aggregate reads through here.
 *
 * Rule: NO inline SQL or aggregation in Express handlers or React
 * components. Every function here maps 1:1 to a `v_*` view declared
 * in drizzle/0000_baseline.sql. If a KPI needs a new formula, add
 * or amend the view (SQL migration) — do not compute it in TypeScript.
 *
 * Drizzle numeric columns arrive as strings; every function coerces to
 * number|null at the boundary via `toNumberOrNull` so the frontend
 * never has to parse them.
 */

import { desc, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { toNumberOrNull } from './numbers.js';
import {
  vCosEotRecords,
  vDistrictSummary,
  vFinancialSecurities,
  vManagementActionSummary,
  vMilestoneHistory,
  vOmExpiryAlerts,
  vOmStatus,
  vOutstandingGaps,
  vOverviewKpis,
  vPbgExpiryAlerts,
  vProjectDelayStatus,
  vProjectPhysicalHistory,
  vScheduleVsActual,
  vSchemeChart,
  vSchemeSummary,
  vSectorSummary,
  vStageBuckets,
  vStatusDonut,
  vWorkTypeCounts,
} from '../db/views.js';

/* ============================================================
 * PORTFOLIO KPIs
 * ============================================================ */

export interface OverviewKpis {
  total: number;
  completed: number;
  inProgress: number;
  delayed: number;
  onHold: number;
  notStarted: number;
  totalAaCr: number | null;
  totalAgreementCr: number | null;
  totalFinancialCr: number | null;
  avgPhysicalPct: number | null;
  avgFinancialPct: number | null;
  financialUtilisationPct: number | null;
}

export async function getOverviewKpis(): Promise<OverviewKpis> {
  const [row] = await db.select().from(vOverviewKpis);
  return {
    total: row?.total ?? 0,
    completed: row?.completed ?? 0,
    inProgress: row?.inProgress ?? 0,
    delayed: row?.delayed ?? 0,
    onHold: row?.onHold ?? 0,
    notStarted: row?.notStarted ?? 0,
    totalAaCr: toNumberOrNull(row?.totalAaCr),
    totalAgreementCr: toNumberOrNull(row?.totalAgreementCr),
    totalFinancialCr: toNumberOrNull(row?.totalFinancialCr),
    avgPhysicalPct: toNumberOrNull(row?.avgPhysicalPct),
    avgFinancialPct: toNumberOrNull(row?.avgFinancialPct),
    financialUtilisationPct: toNumberOrNull(row?.financialUtilisationPct),
  };
}

export interface ScheduleVsActual {
  avgActualPct: number | null;
  avgScheduledPctRaw: number | null;
  projectsWithSchedule: number;
  avgScheduledPctEffective: number | null;
}

export async function getScheduleVsActual(): Promise<ScheduleVsActual> {
  const [row] = await db.select().from(vScheduleVsActual);
  return {
    avgActualPct: toNumberOrNull(row?.avgActualPct),
    avgScheduledPctRaw: toNumberOrNull(row?.avgScheduledPctRaw),
    projectsWithSchedule: row?.projectsWithSchedule ?? 0,
    avgScheduledPctEffective: toNumberOrNull(row?.avgScheduledPctEffective),
  };
}

export interface StageBucket {
  stage: string;
  projectCount: number;
  totalAaCr: number | null;
}

export async function getStageBuckets(): Promise<StageBucket[]> {
  const rows = await db.select().from(vStageBuckets);
  return rows.map((r) => ({
    stage: r.stage ?? '',
    projectCount: r.projectCount ?? 0,
    totalAaCr: toNumberOrNull(r.totalAaCr),
  }));
}

export interface WorkTypeCounts {
  tenderWorks: number;
  tenderServices: number;
  preMonsoon: number;
  preMonsoonCritical: number;
}

export async function getWorkTypeCounts(): Promise<WorkTypeCounts> {
  const [row] = await db.select().from(vWorkTypeCounts);
  return {
    tenderWorks: row?.tenderWorks ?? 0,
    tenderServices: row?.tenderServices ?? 0,
    preMonsoon: row?.preMonsoon ?? 0,
    preMonsoonCritical: row?.preMonsoonCritical ?? 0,
  };
}

export interface FinancialSecurities {
  totalMobAdvanceCr: number | null;
  totalAdvanceOutstandingCr: number | null;
  totalRetentionCr: number | null;
  totalPbgCr: number | null;
  totalEmdCr: number | null;
  pbgExpiredCount: number;
}

export async function getFinancialSecurities(): Promise<FinancialSecurities> {
  const [row] = await db.select().from(vFinancialSecurities);
  return {
    totalMobAdvanceCr: toNumberOrNull(row?.totalMobAdvanceCr),
    totalAdvanceOutstandingCr: toNumberOrNull(row?.totalAdvanceOutstandingCr),
    totalRetentionCr: toNumberOrNull(row?.totalRetentionCr),
    totalPbgCr: toNumberOrNull(row?.totalPbgCr),
    totalEmdCr: toNumberOrNull(row?.totalEmdCr),
    pbgExpiredCount: row?.pbgExpiredCount ?? 0,
  };
}

/* ============================================================
 * ALERT LISTS
 * ============================================================ */

export interface PbgExpiryAlert {
  projectId: string;
  projectName: string | null;
  districtId: number | null;
  city: string | null;
  pbgExpiryDate: string | null;
  daysLeft: number | null;
}

export async function getPbgExpiryAlerts(): Promise<PbgExpiryAlert[]> {
  const rows = await db.select().from(vPbgExpiryAlerts);
  return rows.map((r) => ({
    projectId: r.projectId,
    projectName: r.projectName ?? null,
    districtId: r.districtId ?? null,
    city: r.city ?? null,
    pbgExpiryDate: r.pbgExpiryDate ?? null,
    daysLeft: r.daysLeft ?? null,
  }));
}

export interface OmStatusRow {
  projectId: string;
  projectName: string | null;
  omAgency: string | null;
  startDate: string | null;
  endDate: string | null;
  totalDays: number | null;
  elapsedDays: number | null;
  daysLeft: number | null;
  pctElapsed: number | null;
  status: string | null;
}

function toOmRow(r: {
  projectId: string;
  projectName: string | null;
  omAgency: string | null;
  startDate: string | null;
  endDate: string | null;
  totalDays: number | null;
  elapsedDays: number | null;
  daysLeft: number | null;
  pctElapsed: string | null;
  status: string | null;
}): OmStatusRow {
  return {
    projectId: r.projectId,
    projectName: r.projectName,
    omAgency: r.omAgency,
    startDate: r.startDate,
    endDate: r.endDate,
    totalDays: r.totalDays,
    elapsedDays: r.elapsedDays,
    daysLeft: r.daysLeft,
    pctElapsed: toNumberOrNull(r.pctElapsed),
    status: r.status,
  };
}

export async function getOmStatus(): Promise<OmStatusRow[]> {
  const rows = await db.select().from(vOmStatus);
  return rows.map(toOmRow);
}

export async function getOmExpiryAlerts(): Promise<OmStatusRow[]> {
  const rows = await db.select().from(vOmExpiryAlerts);
  return rows.map(toOmRow);
}

/* ============================================================
 * CHART SUMMARIES (small, bounded — return everything)
 * ============================================================ */

export interface SchemeChartRow {
  schemeId: number;
  schemeName: string;
  projectCount: number;
  avgPhysicalPct: number | null;
  avgFinancialPct: number | null;
  totalAgreementCr: number | null;
  totalFinancialCr: number | null;
}

export async function getSchemeChart(): Promise<SchemeChartRow[]> {
  const rows = await db.select().from(vSchemeChart);
  return rows.map((r) => ({
    schemeId: r.schemeId,
    schemeName: r.schemeName,
    projectCount: r.projectCount ?? 0,
    avgPhysicalPct: toNumberOrNull(r.avgPhysicalPct),
    avgFinancialPct: toNumberOrNull(r.avgFinancialPct),
    totalAgreementCr: toNumberOrNull(r.totalAgreementCr),
    totalFinancialCr: toNumberOrNull(r.totalFinancialCr),
  }));
}

export interface StatusDonutRow {
  status: string;
  projectCount: number;
}

export async function getStatusDonut(): Promise<StatusDonutRow[]> {
  const rows = await db.select().from(vStatusDonut);
  return rows.map((r) => ({ status: r.status, projectCount: r.projectCount ?? 0 }));
}

export interface SchemeSummaryRow {
  schemeId: number;
  schemeName: string;
  total: number;
  completed: number;
  inProgress: number;
  delayed: number;
}

export async function getSchemeSummary(): Promise<SchemeSummaryRow[]> {
  const rows = await db.select().from(vSchemeSummary);
  return rows.map((r) => ({
    schemeId: r.schemeId,
    schemeName: r.schemeName,
    total: r.total ?? 0,
    completed: r.completed ?? 0,
    inProgress: r.inProgress ?? 0,
    delayed: r.delayed ?? 0,
  }));
}

export interface SectorSummaryRow {
  sectorId: number;
  sectorName: string;
  total: number;
  completed: number;
  inProgress: number;
  delayed: number;
}

export async function getSectorSummary(): Promise<SectorSummaryRow[]> {
  const rows = await db.select().from(vSectorSummary);
  return rows.map((r) => ({
    sectorId: r.sectorId,
    sectorName: r.sectorName,
    total: r.total ?? 0,
    completed: r.completed ?? 0,
    inProgress: r.inProgress ?? 0,
    delayed: r.delayed ?? 0,
  }));
}

export interface DistrictSummaryRow {
  districtId: number;
  districtName: string;
  total: number;
  completed: number;
  delayed: number;
  completionRatePct: number | null;
}

export async function getDistrictSummary(): Promise<DistrictSummaryRow[]> {
  const rows = await db.select().from(vDistrictSummary);
  return rows.map((r) => ({
    districtId: r.districtId,
    districtName: r.districtName,
    total: r.total ?? 0,
    completed: r.completed ?? 0,
    delayed: r.delayed ?? 0,
    completionRatePct: toNumberOrNull(r.completionRatePct),
  }));
}

/* ============================================================
 * DELAY / OUTSTANDING GAP / MANAGEMENT ACTION
 * ============================================================ */

export interface DelayStatusRow {
  projectId: string;
  projectName: string | null;
  status: string | null;
  plannedEndDate: string | null;
  effectiveRevisedEndDate: string | null;
  totalDelayDays: number | null;
  coveredByEotDays: number | null;
  uncoveredDelayDays: number | null;
}

export async function getDelayStatus(): Promise<DelayStatusRow[]> {
  const rows = await db.select().from(vProjectDelayStatus);
  return rows.map((r) => ({
    projectId: r.projectId,
    projectName: r.projectName,
    status: r.status,
    plannedEndDate: r.plannedEndDate,
    effectiveRevisedEndDate: r.effectiveRevisedEndDate,
    totalDelayDays: r.totalDelayDays,
    coveredByEotDays: r.coveredByEotDays,
    uncoveredDelayDays: r.uncoveredDelayDays,
  }));
}

export interface OutstandingGapRow {
  projectId: string;
  projectName: string | null;
  sectorId: number | null;
  districtId: number | null;
  priority: string | null;
  remark: string | null;
  status: string | null;
}

export async function getOutstandingGaps(): Promise<OutstandingGapRow[]> {
  const rows = await db.select().from(vOutstandingGaps);
  return rows.map((r) => ({
    projectId: r.projectId,
    projectName: r.projectName,
    sectorId: r.sectorId,
    districtId: r.districtId,
    priority: r.priority,
    remark: r.remark,
    status: r.status,
  }));
}

export interface ManagementActionSummaryRow {
  projectId: string;
  projectName: string | null;
  totalItems: number;
  openItems: number;
  closedItems: number;
}

export async function getManagementActionSummary(): Promise<ManagementActionSummaryRow[]> {
  const rows = await db.select().from(vManagementActionSummary);
  return rows.map((r) => ({
    projectId: r.projectId,
    projectName: r.projectName,
    totalItems: r.totalItems ?? 0,
    openItems: r.openItems ?? 0,
    closedItems: r.closedItems ?? 0,
  }));
}

/* ============================================================
 * COS/EOT LISTING (paginated)
 * ============================================================ */

export interface CosEotRecord {
  cosId: number;
  projectId: string;
  projectName: string | null;
  sectorId: number | null;
  districtId: number | null;
  cosNumber: string | null;
  cosDate: string | null;
  category: string | null;
  cosAmountCr: number | null;
  variationPct: number | null;
  eotNumber: string | null;
  eotDaysGranted: number | null;
  timeLinked: boolean | null;
  originalEndDate: string | null;
  newEndDate: string | null;
  revisedDate: string | null;
}

export async function listCosEotRecords(limit: number, offset: number): Promise<CosEotRecord[]> {
  const rows = await db
    .select()
    .from(vCosEotRecords)
    .orderBy(desc(vCosEotRecords.cosDate), desc(vCosEotRecords.cosId))
    .limit(limit)
    .offset(offset);
  return rows.map((r) => ({
    cosId: r.cosId,
    projectId: r.projectId,
    projectName: r.projectName,
    sectorId: r.sectorId,
    districtId: r.districtId,
    cosNumber: r.cosNumber,
    cosDate: r.cosDate,
    category: r.category,
    cosAmountCr: toNumberOrNull(r.cosAmountCr),
    variationPct: toNumberOrNull(r.variationPct),
    eotNumber: r.eotNumber,
    eotDaysGranted: r.eotDaysGranted,
    timeLinked: r.timeLinked,
    originalEndDate: r.originalEndDate,
    newEndDate: r.newEndDate,
    revisedDate: r.revisedDate,
  }));
}

/* ============================================================
 * PER-PROJECT MILESTONE / PHYSICAL PROGRESS HISTORY
 * ============================================================ */

export interface PhysicalHistoryPoint {
  snapMonth: string;
  weightedPhysicalPct: number | null;
}

export async function getProjectPhysicalHistory(
  projectId: string,
): Promise<PhysicalHistoryPoint[]> {
  const rows = await db
    .select()
    .from(vProjectPhysicalHistory)
    .where(sql`${vProjectPhysicalHistory.projectId} = ${projectId}`);
  return rows.map((r) => ({
    snapMonth: r.snapMonth,
    weightedPhysicalPct: toNumberOrNull(r.weightedPhysicalPct),
  }));
}

export interface MilestoneHistoryPoint {
  milestoneId: number;
  milestoneName: string;
  weightPct: number | null;
  snapMonth: string;
  progressPct: number | null;
  weightedContribution: number | null;
}

export async function getProjectMilestoneHistory(
  projectId: string,
): Promise<MilestoneHistoryPoint[]> {
  const rows = await db
    .select()
    .from(vMilestoneHistory)
    .where(sql`${vMilestoneHistory.projectId} = ${projectId}`);
  return rows.map((r) => ({
    milestoneId: r.milestoneId,
    milestoneName: r.milestoneName,
    weightPct: toNumberOrNull(r.weightPct),
    snapMonth: r.snapMonth,
    progressPct: toNumberOrNull(r.progressPct),
    weightedContribution: toNumberOrNull(r.weightedContribution),
  }));
}
