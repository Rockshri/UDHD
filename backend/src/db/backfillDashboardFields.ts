/**
 * One-shot backfill for existing project rows so the new Overview page
 * dashboard cards + charts render meaningful values instead of NULL.
 *
 * ─── Fields backfilled (NULL cells ONLY — non-NULL preserved) ──────────
 *   - contract_type         →  Work 50% / Service 30% / O&M 15% / Others 5%
 *   - project_stage_v2      →  Conceptualisation 10% / Design 10% /
 *                              Pre-Tender 15% / Tender 20% / Construction
 *                              30% / O&M 10% / Other 5%
 *   - aa_amount_cr          →  random ₹ 5-500 Cr with a log-ish skew
 *   - agreement_amount_cr   →  90-110% of the (final) AA amount
 *   - financial_progress_cr →  status-aware fraction of agreement value
 *                              (Completed=95%, In Progress=50%, others=15%)
 *   - financial_progress_pct → matches financial_progress_cr / agreement
 *   - physical_progress_pct  → status-aware realistic %
 *
 * ─── Rules ───────────────────────────────────────────────────────────
 *   - Idempotent: WHERE column IS NULL guarantees re-runs don't reshuffle.
 *   - Deterministic-ish: uses Math.random per row → different re-runs
 *     would produce different values, but re-runs only affect rows that
 *     are STILL NULL, so the second run is effectively a no-op.
 *   - No audit rows written — this is a data-quality backfill, not a
 *     business event. Add manual audit entries if that becomes a policy.
 *   - Bypasses updated_at (no touch triggers) so already-clean rows
 *     don't get spurious edits.
 *
 * Usage:
 *   npm run db:backfill-dashboard              # local (uses .env.local)
 *   DATABASE_URL=<prod-url> npm run db:backfill-dashboard  # against prod
 */

import { and, isNull, sql } from 'drizzle-orm';
import { db, pool } from './client.js';
import { project } from './schema.js';

// ─── Distribution helpers ─────────────────────────────────────────────

type Weighted<T> = Array<[T, number]>;

/** Pick from a weighted list. Weights don't need to sum to 1. */
function weightedPick<T>(items: Weighted<T>): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [val, w] of items) {
    r -= w;
    if (r <= 0) return val;
  }
  return items[items.length - 1]![0];
}

const CONTRACT_TYPE_DIST: Weighted<'Work Contract' | 'Service Contract' | 'O&M Contract' | 'Others'> = [
  ['Work Contract',    50],
  ['Service Contract', 30],
  ['O&M Contract',     15],
  ['Others',            5],
];

const STAGE_DIST: Weighted<'Conceptualisation' | 'Design' | 'Pre-Tender' | 'Tender' | 'Construction' | 'O&M' | 'Other'> = [
  ['Conceptualisation', 10],
  ['Design',            10],
  ['Pre-Tender',        15],
  ['Tender',            20],
  ['Construction',      30],
  ['O&M',               10],
  ['Other',              5],
];

/**
 * Random AA amount in ₹ Cr with a log-ish skew (most projects small,
 * a few large). Range 5-500 Cr.
 */
function randomAaCr(): number {
  const u = Math.random();
  // exp scale so ~70% of values are under 100 Cr
  const cr = 5 + Math.exp(u * Math.log(500 / 5)) - 1;
  return Math.round(cr * 100) / 100;
}

/** Multiplier so agreement is 90-110% of AA (contract negotiation drift). */
function agreementMultiplier(): number {
  return 0.9 + Math.random() * 0.2;
}

/** Progress fraction to apply to agreement amount, based on status. */
function progressFraction(status: string | null): number {
  const jitter = (Math.random() * 0.2) - 0.1; // ±10%
  switch (status) {
    case 'Completed':   return Math.max(0.85, Math.min(1.0, 0.95 + jitter));
    case 'In Progress': return Math.max(0.20, Math.min(0.80, 0.50 + jitter));
    case 'Delayed':     return Math.max(0.10, Math.min(0.70, 0.35 + jitter));
    case 'On Hold':     return Math.max(0.05, Math.min(0.60, 0.25 + jitter));
    case 'Not Started': return 0;
    default:            return Math.max(0.10, Math.min(0.60, 0.30 + jitter));
  }
}

// ─── Backfill steps ──────────────────────────────────────────────────

interface Counts { targeted: number; updated: number }

async function backfillContractType(): Promise<Counts> {
  const rows = await db.select({ projectId: project.projectId })
    .from(project)
    .where(isNull(project.contractType));
  let updated = 0;
  for (const r of rows) {
    const ct = weightedPick(CONTRACT_TYPE_DIST);
    await db.execute(sql`UPDATE project SET contract_type = ${ct} WHERE project_id = ${r.projectId} AND contract_type IS NULL`);
    updated++;
  }
  return { targeted: rows.length, updated };
}

async function backfillProjectStageV2(): Promise<Counts> {
  const rows = await db.select({ projectId: project.projectId })
    .from(project)
    .where(isNull(project.projectStageV2));
  let updated = 0;
  for (const r of rows) {
    const stage = weightedPick(STAGE_DIST);
    // DB constraint `project_tender_sub_stage_coupling` requires that when
    // project_stage_v2 = 'Tender', tender_sub_stage must also be non-NULL.
    // Seed a plausible starting sub-stage; the Tender Dashboard can then
    // walk it forward via the transfer flow.
    if (stage === 'Tender') {
      await db.execute(sql`
        UPDATE project
        SET project_stage_v2 = ${stage},
            tender_sub_stage = 'NIT Published'
        WHERE project_id = ${r.projectId}
          AND project_stage_v2 IS NULL
      `);
    } else {
      await db.execute(sql`
        UPDATE project
        SET project_stage_v2 = ${stage}
        WHERE project_id = ${r.projectId}
          AND project_stage_v2 IS NULL
      `);
    }
    updated++;
  }
  return { targeted: rows.length, updated };
}

async function backfillAaAmount(): Promise<Counts> {
  const rows = await db.select({ projectId: project.projectId })
    .from(project)
    .where(isNull(project.aaAmountCr));
  let updated = 0;
  for (const r of rows) {
    const aa = randomAaCr();
    await db.execute(sql`UPDATE project SET aa_amount_cr = ${aa} WHERE project_id = ${r.projectId} AND aa_amount_cr IS NULL`);
    updated++;
  }
  return { targeted: rows.length, updated };
}

/** Fills agreement_amount_cr based on aa_amount_cr (only where BOTH cols valid to compute). */
async function backfillAgreementAmount(): Promise<Counts> {
  const rows = await db.execute<{ project_id: string; aa_amount_cr: string | null }>(sql`
    SELECT project_id, aa_amount_cr FROM project
    WHERE agreement_amount_cr IS NULL AND aa_amount_cr IS NOT NULL
  `);
  const list = (rows as unknown as { rows: Array<{ project_id: string; aa_amount_cr: string | null }> }).rows;
  let updated = 0;
  for (const r of list) {
    const aa = Number(r.aa_amount_cr);
    if (!Number.isFinite(aa)) continue;
    const agreement = Math.round(aa * agreementMultiplier() * 100) / 100;
    await db.execute(sql`UPDATE project SET agreement_amount_cr = ${agreement} WHERE project_id = ${r.project_id} AND agreement_amount_cr IS NULL`);
    updated++;
  }
  return { targeted: list.length, updated };
}

/** Fills financial_progress_cr + _pct based on status + agreement (or AA fallback). */
async function backfillFinancialProgress(): Promise<Counts> {
  const rows = await db.execute<{
    project_id: string;
    status: string | null;
    agreement_amount_cr: string | null;
    aa_amount_cr: string | null;
    financial_progress_cr: string | null;
    financial_progress_pct: string | null;
  }>(sql`
    SELECT project_id, status, agreement_amount_cr, aa_amount_cr,
           financial_progress_cr, financial_progress_pct
    FROM project
    WHERE (financial_progress_cr IS NULL OR financial_progress_pct IS NULL)
      AND (agreement_amount_cr IS NOT NULL OR aa_amount_cr IS NOT NULL)
  `);
  const list = (rows as unknown as {
    rows: Array<{
      project_id: string;
      status: string | null;
      agreement_amount_cr: string | null;
      aa_amount_cr: string | null;
      financial_progress_cr: string | null;
      financial_progress_pct: string | null;
    }>;
  }).rows;
  let updated = 0;
  for (const r of list) {
    const base = Number(r.agreement_amount_cr ?? r.aa_amount_cr ?? 0);
    if (!Number.isFinite(base) || base <= 0) continue;
    const frac = progressFraction(r.status);
    const spentCr = Math.round(base * frac * 100) / 100;
    const pct = Math.round(frac * 1000) / 10; // 1 decimal
    // Only fill the NULL columns — leave anything already set alone.
    if (r.financial_progress_cr === null) {
      await db.execute(sql`UPDATE project SET financial_progress_cr = ${spentCr} WHERE project_id = ${r.project_id} AND financial_progress_cr IS NULL`);
    }
    if (r.financial_progress_pct === null) {
      await db.execute(sql`UPDATE project SET financial_progress_pct = ${pct} WHERE project_id = ${r.project_id} AND financial_progress_pct IS NULL`);
    }
    updated++;
  }
  return { targeted: list.length, updated };
}

async function backfillPhysicalProgress(): Promise<Counts> {
  const rows = await db.execute<{ project_id: string; status: string | null }>(sql`
    SELECT project_id, status FROM project WHERE physical_progress_pct IS NULL
  `);
  const list = (rows as unknown as { rows: Array<{ project_id: string; status: string | null }> }).rows;
  let updated = 0;
  for (const r of list) {
    const frac = progressFraction(r.status);
    // Physical progress usually leads or trails financial slightly.
    const pct = Math.max(0, Math.min(100, Math.round(frac * 100 + (Math.random() * 10 - 5))));
    await db.execute(sql`UPDATE project SET physical_progress_pct = ${pct} WHERE project_id = ${r.project_id} AND physical_progress_pct IS NULL`);
    updated++;
  }
  return { targeted: list.length, updated };
}

// ─── Runner ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  const log = (label: string, c: Counts): void =>
    console.log(`[backfill] ${label.padEnd(28)} targeted=${c.targeted}\tupdated=${c.updated}`);

  log('contract_type',           await backfillContractType());
  log('project_stage_v2',        await backfillProjectStageV2());
  log('aa_amount_cr',            await backfillAaAmount());
  log('agreement_amount_cr',     await backfillAgreementAmount());
  log('financial_progress_*',    await backfillFinancialProgress());
  log('physical_progress_pct',   await backfillPhysicalProgress());

  // eslint-disable-next-line no-console
  console.log('\n[backfill] All done. Non-NULL cells were untouched.');
}

main()
  .then(() => pool.end())
  .catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('[backfill] FAILED', err);
    return pool.end().finally(() => process.exit(1));
  });
