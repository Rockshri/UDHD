/**
 * One-shot script to create or upsert an initial user (typically MD).
 *
 * Usage:
 *   npm run db:seed-admin -- --username shri --password 'test1234' --role MD --full-name 'Shri Test'
 *
 * Env fallback (if CLI args not supplied):
 *   SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD, SEED_ADMIN_ROLE, SEED_ADMIN_FULL_NAME
 */

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, pool } from './client.js';
import { userRoles } from './enums.js';
import { appUser } from './schema.js';
import { hashPassword } from '../lib/passwords.js';

function argMap(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg && arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[key] = next;
        i++;
      } else {
        out[key] = 'true';
      }
    }
  }
  return out;
}

const inputSchema = z.object({
  username: z.string().min(3).max(60),
  password: z.string().min(8).max(200),
  role: z.enum(userRoles),
  fullName: z.string().min(1).max(120).optional(),
});

async function run(): Promise<void> {
  const args = argMap(process.argv.slice(2));
  const parsed = inputSchema.safeParse({
    username: args.username ?? process.env.SEED_ADMIN_USERNAME,
    password: args.password ?? process.env.SEED_ADMIN_PASSWORD,
    role: args.role ?? process.env.SEED_ADMIN_ROLE,
    fullName: args['full-name'] ?? args.fullName ?? process.env.SEED_ADMIN_FULL_NAME,
  });

  if (!parsed.success) {
    const details = JSON.stringify(parsed.error.flatten().fieldErrors);
    throw new Error(
      `Invalid seed input. Provide --username, --password, --role (MD|Admin|Viewer), optional --full-name. Details: ${details}`,
    );
  }

  const { username, password, role, fullName } = parsed.data;
  const passwordHash = await hashPassword(password);

  const [existing] = await db.select().from(appUser).where(eq(appUser.username, username)).limit(1);

  if (existing) {
    await db
      .update(appUser)
      .set({
        passwordHash,
        role,
        fullName: fullName ?? existing.fullName,
        isActive: true,
      })
      .where(eq(appUser.userId, existing.userId));
    process.stdout.write(`updated user ${username} (id ${existing.userId}) as ${role}\n`);
  } else {
    const [inserted] = await db
      .insert(appUser)
      .values({
        username,
        passwordHash,
        role,
        fullName: fullName ?? null,
        isActive: true,
      })
      .returning({ userId: appUser.userId });
    process.stdout.write(`created user ${username} (id ${inserted?.userId}) as ${role}\n`);
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
