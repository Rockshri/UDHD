/**
 * Tender workflow — server-backed sub-stage helpers.
 *
 * The sub-stage field lives on `project.tender_sub_stage`. RTK Query is the
 * source of truth; this module only re-exports the enum and a couple of
 * shared helpers so the modal + Input Sheet stay decoupled from the raw
 * API layer.
 */

import type { ProjectListItem, TenderSubStage } from '../../types/api';

export const TENDER_SUB_STAGES: readonly TenderSubStage[] = [
  'NIT Published',
  'Bid Submission (Open)',
  'Technical Evaluation',
  'Financial Evaluation',
  'Approval Process',
  'LoA Issued',
  'Agreement Signing',
  'Work Order Issued',
];

export const FIRST_TENDER_SUB_STAGE: TenderSubStage = 'NIT Published';
export const FINAL_TENDER_SUB_STAGE: TenderSubStage = 'Work Order Issued';

/**
 * Group a set of Tender-stage projects by their current sub-stage.
 * Returns a Map keyed by every sub-stage so callers can render KPI cards
 * with zero-count buckets without extra branching.
 */
export function bucketByTenderSubStage(
  projects: ProjectListItem[],
): Map<TenderSubStage, ProjectListItem[]> {
  const out = new Map<TenderSubStage, ProjectListItem[]>();
  for (const stage of TENDER_SUB_STAGES) out.set(stage, []);
  for (const p of projects) {
    if (p.projectStageV2 !== 'Tender') continue;
    const stage = p.tenderSubStage ?? FIRST_TENDER_SUB_STAGE;
    const bucket = out.get(stage);
    if (bucket) bucket.push(p);
  }
  return out;
}

/**
 * Is the project past the tender workflow? True only when the server has
 * marked the project at the final sub-stage. Used to gate Construction in
 * the Input Sheet.
 */
export function isTenderCompleted(project: {
  projectStageV2: string | null;
  tenderSubStage: TenderSubStage | null;
}): boolean {
  return (
    project.projectStageV2 === 'Tender' &&
    project.tenderSubStage === FINAL_TENDER_SUB_STAGE
  );
}
