/**
 * One-off backfill: assign division_id (round-robin) to every project row
 * that currently has division_id = NULL.
 *
 * Rationale: migration 0007 auto-mapped district_id → division_id, but most
 * project rows never had a district_id set, so 298/301 rows ended up with
 * NULL division_id. That renders the Phase C2 PD division-filtering
 * effectively empty for any PD whose division happens to have no data.
 * This script spreads the orphans evenly across all divisions so
 * PDs actually see meaningful filtered data during testing.
 *
 * Idempotent — running twice is a no-op after the first run, since
 * matching rows no longer exist.
 *
 * Usage:  npm run db:backfill-divisions
 */

import { eq, isNull, sql } from 'drizzle-orm';
import { db, pool } from '../db/client.js';
import { division, project } from '../db/schema.js';

async function run(): Promise<void> {
  const orphans = await db
    .select({ projectId: project.projectId })
    .from(project)
    .where(isNull(project.divisionId))
    .orderBy(project.projectId);

  if (orphans.length === 0) {
    process.stdout.write('No projects with NULL division_id — nothing to do.\n');
    return;
  }

  const divisions = await db
    .select({ divisionId: division.divisionId, divisionName: division.divisionName })
    .from(division)
    .orderBy(division.divisionId);

  if (divisions.length === 0) {
    process.stderr.write('No divisions configured — cannot backfill. Aborting.\n');
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `Assigning ${orphans.length} orphan project(s) round-robin across ${divisions.length} division(s)…\n`,
  );

  await db.transaction(async (tx) => {
    for (let i = 0; i < orphans.length; i++) {
      const target = divisions[i % divisions.length]!;
      const orphan = orphans[i]!;
      await tx
        .update(project)
        .set({ divisionId: target.divisionId })
        .where(eq(project.projectId, orphan.projectId));
    }
  });

  // Report the distribution after the run so it's obvious things landed
  // where we expected them to.
  const distribution = await db.execute<{ division_name: string; n: number | string }>(sql`
    SELECT d.division_name, COUNT(p.project_id) AS n
    FROM division d
    LEFT JOIN project p ON p.division_id = d.division_id
    GROUP BY d.division_name
    HAVING COUNT(p.project_id) > 0
    ORDER BY n DESC, d.division_name
  `);
  process.stdout.write(`Backfill complete. Projects per division:\n`);
  for (const r of distribution.rows) {
    process.stdout.write(`  ${r.division_name}: ${r.n}\n`);
  }
}

run()
  .catch((err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
