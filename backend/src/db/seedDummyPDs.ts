/**
 * One-shot dummy-data seeder for local development / demoing.
 *
 * Creates 3 dummy PD (Project Director) accounts, each assigned to the
 * Division of one of the dummy projects seeded by seedDummyProjects.ts —
 * the project's `pd` field already names them, so this just gives that
 * name a real login scoped to the matching division. Once logged in, a PD
 * only sees projects in their division, so this is how a project gets
 * "assigned" to a PD in this app (there's no direct project→PD foreign
 * key — division membership is what drives visibility).
 *
 * Goes through the same createUser() service function the API route uses,
 * so seeded accounts get real audit trail entries and pass the same
 * validation as an Admin-created one — same pattern as seedDummyProjects.ts.
 *
 * Idempotent: skips any account whose username already exists.
 *
 * Usage:
 *   npm run db:seed-dummy-pds
 *
 * All 3 accounts share the password printed below — for local dev only.
 */

import { eq } from 'drizzle-orm';
import { db, pool } from './client.js';
import { appUser } from './schema.js';
import type { AuditActor } from '../lib/audit.js';
import { createUser } from '../services/usersService.js';

const SEED_ACTOR: AuditActor = {
  userId: null,
  username: 'system:seed',
  role: 'MD',
};

const SEED_PASSWORD = 'Buidco@Demo123';

interface DummyPD {
  username: string;
  fullName: string;
  divisionName: string;
  /** The project this PD is named on (`project.pd`) — shown here just for the log output. */
  assignedProject: string;
}

const DUMMY_PDS: DummyPD[] = [
  {
    username: 'sunita.devi',
    fullName: 'Sunita Devi',
    divisionName: 'Gaya',
    assignedProject: 'Gaya Water Supply Augmentation Scheme',
  },
  {
    username: 'anjali.kumari',
    fullName: 'Anjali Kumari',
    divisionName: 'Muzaffarpur',
    assignedProject: 'Muzaffarpur Electric Crematorium Modernisation',
  },
  {
    username: 'priya.ranjan',
    fullName: 'Priya Ranjan',
    divisionName: 'Darbhanga',
    assignedProject: 'Darbhanga Water Supply Distribution Network Upgrade',
  },
];

async function main(): Promise<void> {
  const divisionRows = await db.query.division.findMany();
  const divisionByName = new Map(divisionRows.map((d) => [d.divisionName, d.divisionId]));

  for (const pd of DUMMY_PDS) {
    const [existing] = await db
      .select({ userId: appUser.userId })
      .from(appUser)
      .where(eq(appUser.username, pd.username))
      .limit(1);
    if (existing) {
      process.stdout.write(`skip  ${pd.username} (already exists)\n`);
      continue;
    }

    const divisionId = divisionByName.get(pd.divisionName);
    if (!divisionId) {
      process.stderr.write(`  ! division "${pd.divisionName}" not found — skipping ${pd.username}\n`);
      continue;
    }

    await createUser(
      {
        username: pd.username,
        password: SEED_PASSWORD,
        fullName: pd.fullName,
        role: 'PD',
        divisions: [divisionId],
        canViewProjects: true,
        canUpdateProjects: true,
        canCreateProjects: false,
        canDeleteProjects: false,
      },
      SEED_ACTOR,
    );

    process.stdout.write(
      `apply ${pd.username} — PD, division "${pd.divisionName}" — sees "${pd.assignedProject}"\n`,
    );
  }

  process.stdout.write(`\nAll dummy PDs share the password: ${SEED_PASSWORD}\n`);
  process.stdout.write('Dummy PD seed complete.\n');
}

main()
  .catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
