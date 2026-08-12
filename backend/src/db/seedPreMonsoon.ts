/**
 * Small companion seeder for the `pre_monsoon_item` table.
 *
 * `pre_monsoon_item` is a global list (no project or division scope), so
 * these rows populate the Overview page's "Pre-Monsoon Prep" card and the
 * /pre-monsoon page immediately for every user role.
 *
 * Rules (kept intentionally similar to seedProjects.ts):
 *   - Idempotent: skips inserts if the exact `topic` already exists.
 *   - No audit trail — this table doesn't participate in the project
 *     audit flow (mirrors how the app's own POST /pre-monsoon doesn't
 *     write audit rows either).
 *
 * Usage:
 *   npm run db:seed-premonsoon
 *
 * Idempotency lets you re-run safely; e.g. after a schema migration.
 */

import { eq } from 'drizzle-orm';
import { db, pool } from './client.js';
import { preMonsoonItem } from './schema.js';

interface SeedItem {
  topic: string;
  priority: 'High' | 'Medium' | 'Low' | null;
  /** Days from today; null means no deadline. */
  deadlineDaysFromNow: number | null;
}

/**
 * Realistic pre-monsoon prep topics for a Bihar urban infrastructure
 * portfolio (drainage, pumping, cleaning). 8 rows chosen to give the
 * dashboard card a non-trivial count without spamming the /pre-monsoon
 * page. Adjust as needed.
 */
const SEEDS: SeedItem[] = [
  { topic: 'Storm drain de-silting — priority wards',        priority: 'High',   deadlineDaysFromNow: 21 },
  { topic: 'Pump station commissioning inspection',           priority: 'High',   deadlineDaysFromNow: 30 },
  { topic: 'Nala cleaning — main channels',                   priority: 'High',   deadlineDaysFromNow: 14 },
  { topic: 'DG-set fuel & battery check for pump houses',     priority: 'Medium', deadlineDaysFromNow: 25 },
  { topic: 'Encroachment removal on drainage right-of-way',   priority: 'Medium', deadlineDaysFromNow: 45 },
  { topic: 'Emergency response team drill',                   priority: 'Medium', deadlineDaysFromNow: 40 },
  { topic: 'Sluice gate maintenance — Patna east zone',       priority: 'Low',    deadlineDaysFromNow: 60 },
  { topic: 'Public information campaign — waterlogging tips', priority: 'Low',    deadlineDaysFromNow: 50 },
];

function toDateString(days: number | null): string | null {
  if (days === null) return null;
  const d = new Date();
  d.setDate(d.getDate() + days);
  // yyyy-mm-dd (Postgres DATE column accepts this)
  return d.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  let inserted = 0;
  let skipped = 0;
  for (const seed of SEEDS) {
    const existing = await db
      .select({ itemId: preMonsoonItem.itemId })
      .from(preMonsoonItem)
      .where(eq(preMonsoonItem.topic, seed.topic))
      .limit(1);
    if (existing.length > 0) {
      skipped++;
      continue;
    }
    await db.insert(preMonsoonItem).values({
      topic: seed.topic,
      priority: seed.priority,
      deadlineDate: toDateString(seed.deadlineDaysFromNow),
    });
    inserted++;
  }
  // eslint-disable-next-line no-console
  console.log(`[seed:pre-monsoon] inserted=${inserted} skipped=${skipped} total_targets=${SEEDS.length}`);
}

main()
  .then(() => pool.end())
  .catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('[seed:pre-monsoon] FAILED', err);
    return pool.end().finally(() => process.exit(1));
  });
