/**
 * Standalone fake-project generator — no external data source required.
 *
 * Creates N fully-populated project rows with realistic-looking randomized
 * values. Uses REAL sector/division/scheme IDs from the DB (queried at
 * runtime) so FK constraints always pass. Distributed across:
 *   - contract_type   (Work 50% / Service 30% / O&M 15% / Others 5%)
 *   - project_stage_v2 (7 stages, weighted)
 *   - status          (Completed 25% / In Progress 40% / Not Started 15%
 *                     / Delayed 15% / On Hold 5%)
 *
 * Every generated row has enough non-NULL data to make every Overview
 * card + chart populate immediately. Idempotent: skips names that
 * already exist so re-runs are safe.
 *
 * Usage:
 *   npm run db:seed-fake -- --count 50
 *   DATABASE_URL=<prod-url> npm run db:seed-fake -- --count 50
 */

import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, pool } from './client.js';
import { division, project, projectScheme, scheme, sector } from './schema.js';

// ─── Config ──────────────────────────────────────────────────────────

const ARGV_COUNT = (() => {
  const idx = process.argv.indexOf('--count');
  if (idx > 0 && process.argv[idx + 1]) {
    const n = Number(process.argv[idx + 1]);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return 50; // default
})();

type ContractType = 'Work Contract' | 'Service Contract' | 'O&M Contract' | 'Others';
type ProjectStage = 'Conceptualisation' | 'Design' | 'Pre-Tender' | 'Tender' | 'Construction' | 'O&M' | 'Other';
type Status = 'Not Started' | 'In Progress' | 'Completed' | 'Delayed' | 'On Hold';

const CONTRACT_TYPE_DIST: Array<[ContractType, number]> = [
  ['Work Contract',    50],
  ['Service Contract', 30],
  ['O&M Contract',     15],
  ['Others',            5],
];

const STAGE_DIST: Array<[ProjectStage, number]> = [
  ['Conceptualisation', 10],
  ['Design',            10],
  ['Pre-Tender',        15],
  ['Tender',            20],
  ['Construction',      30],
  ['O&M',               10],
  ['Other',              5],
];

const STATUS_DIST: Array<[Status, number]> = [
  ['Completed',   25],
  ['In Progress', 40],
  ['Not Started', 15],
  ['Delayed',     15],
  ['On Hold',      5],
];

/** Realistic-sounding project name components for Bihar urban infra. */
const CITY_TOKENS = [
  'Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur', 'Darbhanga',
  'Purnia', 'Ara', 'Begusarai', 'Katihar', 'Chapra',
  'Munger', 'Nalanda', 'Buxar', 'Sasaram', 'Hajipur',
];
const WORK_TOKENS = [
  'Water Supply Augmentation', 'Sewage Treatment Plant', 'Storm Drainage Network',
  'Solid Waste Facility', 'Pumping Station Upgrade', 'Municipal Road Widening',
  'Underground Reservoir', 'Sanitation Facility', 'Waterlogging Mitigation',
  'Sewer Line Extension', 'Rainwater Harvesting', 'Public Toilet Complex',
];

// ─── Helpers ─────────────────────────────────────────────────────────

function pick<T>(list: T[]): T { return list[Math.floor(Math.random() * list.length)]!; }
function weighted<T>(items: Array<[T, number]>): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of items) { r -= w; if (r <= 0) return v; }
  return items[items.length - 1]![0];
}
function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function randInt(lo: number, hi: number): number { return Math.floor(lo + Math.random() * (hi - lo + 1)); }
function round2(n: number): number { return Math.round(n * 100) / 100; }
function round1(n: number): number { return Math.round(n * 10) / 10; }

/** AA amount — log-skew so most projects are 5-100 Cr, a few over 200 Cr. */
function randomAaCr(): number {
  const u = Math.random();
  return round2(5 + Math.exp(u * Math.log(500 / 5)) - 1);
}

function fractionForStatus(s: Status): number {
  const j = (Math.random() * 0.2) - 0.1;
  switch (s) {
    case 'Completed':   return Math.max(0.85, Math.min(1.0,  0.95 + j));
    case 'In Progress': return Math.max(0.25, Math.min(0.80, 0.55 + j));
    case 'Delayed':     return Math.max(0.10, Math.min(0.70, 0.35 + j));
    case 'On Hold':     return Math.max(0.05, Math.min(0.60, 0.25 + j));
    case 'Not Started': return 0;
  }
}

// ─── Runner ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[seed:fake] target count = ${ARGV_COUNT}`);

  // Pull real FK-safe IDs from the DB.
  const sectors   = await db.select({ id: sector.sectorId }).from(sector);
  const divisions = await db.select({ id: division.divisionId }).from(division);
  const schemes   = await db.select({ id: scheme.schemeId }).from(scheme);
  if (sectors.length === 0 || divisions.length === 0) {
    // eslint-disable-next-line no-console
    console.error('[seed:fake] Lookup tables are empty — run migrations first (sectors/divisions must exist).');
    return;
  }
  // eslint-disable-next-line no-console
  console.log(`[seed:fake] lookups: sectors=${sectors.length} divisions=${divisions.length} schemes=${schemes.length}`);

  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < ARGV_COUNT; i++) {
    const city = pick(CITY_TOKENS);
    const work = pick(WORK_TOKENS);
    // Distinct name per row — include the index so re-runs don't collide
    // with prior fakes while still being idempotent by exact name.
    const projectName = `${city} · ${work} — Batch ${new Date().getFullYear()} #${i + 1}`;

    // Skip if a project with this name already exists.
    const existing = await db
      .select({ id: project.projectId })
      .from(project)
      .where(eq(project.projectName, projectName))
      .limit(1);
    if (existing.length > 0) { skipped++; continue; }

    const status = weighted(STATUS_DIST);
    const stage = weighted(STAGE_DIST);
    const contractType = weighted(CONTRACT_TYPE_DIST);
    const aa = randomAaCr();
    const agr = round2(aa * (0.9 + Math.random() * 0.2));
    const frac = fractionForStatus(status);
    const finCr = round2(agr * frac);
    const finPct = round1(frac * 100);
    const phyPct = Math.max(0, Math.min(100, Math.round(frac * 100 + (Math.random() * 10 - 5))));

    // Dates: sanction ~2 years ago, planned end ~ +2y, revised end shifts
    // out for Delayed projects.
    const sanctionDate = daysFromNow(-randInt(400, 900));
    const plannedEnd   = daysFromNow(randInt(-200, 600));
    const revisedEnd   = status === 'Delayed'
      ? daysFromNow(new Date(plannedEnd).getDate() + randInt(60, 180))
      : null;

    const projectId = randomUUID();
    const projectSchemeIds = schemes.length > 0 && Math.random() < 0.7
      ? [pick(schemes).id]
      : [];

    await db.transaction(async (tx) => {
      await tx.insert(project).values({
        projectId,
        projectName,
        sectorId:   pick(sectors).id,
        divisionId: pick(divisions).id,
        contractType,
        projectStageV2: stage,
        // FK/CHECK constraint: stage=Tender requires tender_sub_stage != NULL
        tenderSubStage: stage === 'Tender' ? 'NIT Published' : null,
        status,
        aaAmountCr:              String(aa),
        agreementAmountCr:       String(agr),
        financialProgressCr:     String(finCr),
        financialProgressPct:    String(finPct),
        physicalProgressPct:     String(phyPct),
        sanctionDate,
        plannedEndDate: plannedEnd,
        revisedEndDate: revisedEnd,
        contractor: `${pick(['ABC', 'BDC', 'CDL', 'RCC', 'PWD', 'JMC'])} Infra Pvt Ltd`,
        pd: pick(['Rakesh Kumar', 'Anita Verma', 'Sunil Mehra', 'Priya Singh', 'Vikash Pandey']),
      });

      // Attach scheme if we picked one.
      if (projectSchemeIds.length > 0) {
        await tx.insert(projectScheme).values(
          projectSchemeIds.map((schemeId) => ({ projectId, schemeId })),
        );
      }
    });

    inserted++;
  }

  // eslint-disable-next-line no-console
  console.log(`[seed:fake] inserted=${inserted} skipped=${skipped} target=${ARGV_COUNT}`);
}

main()
  .then(() => pool.end())
  .catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('[seed:fake] FAILED', err);
    return pool.end().finally(() => process.exit(1));
  });
