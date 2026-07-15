import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { userRoles } from '../db/enums.js';
import type { AppUser } from '../db/schema.js';
import { appUser, userDivision } from '../db/schema.js';
import { recordAudit, type AuditActor, type DbExecutor } from '../lib/audit.js';
import { diffAppUser } from '../lib/auditLabels.js';
import { hashPassword } from '../lib/passwords.js';
import { HttpError } from '../middleware/errorHandler.js';

/**
 * Users service — role-aware:
 *   - MD: full CRUD on any user, any role, any flag.
 *   - Admin: sees + edits Viewer users only, cannot promote them,
 *            can toggle their can_*_projects flags.
 *   - Viewer: not allowed here (route middleware rejects).
 *
 * `created_by` is stamped from the actor on create.
 */

export const createUserSchema = z.object({
  username: z.string().min(3).max(60),
  password: z.string().min(8).max(200),
  fullName: z.string().min(1).max(120).nullable().optional(),
  role: z.enum(userRoles),
  canCreateProjects: z.boolean().optional(),
  canUpdateProjects: z.boolean().optional(),
  canDeleteProjects: z.boolean().optional(),
  canViewProjects: z.boolean().optional(),
  /** PD assignment — the PD role validates ≥ 1 division at write time. */
  divisions: z.array(z.number().int().positive()).max(50).optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  fullName: z.string().min(1).max(120).nullable().optional(),
  role: z.enum(userRoles).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).max(200).optional(),
  canCreateProjects: z.boolean().optional(),
  canUpdateProjects: z.boolean().optional(),
  canDeleteProjects: z.boolean().optional(),
  canViewProjects: z.boolean().optional(),
  divisions: z.array(z.number().int().positive()).max(50).optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export interface UserOut {
  userId: number;
  username: string;
  fullName: string | null;
  role: string;
  isActive: boolean | null;
  canCreateProjects: boolean;
  canUpdateProjects: boolean;
  canDeleteProjects: boolean;
  canViewProjects: boolean;
  createdBy: number | null;
  createdAt: Date | null;
  lastLogin: Date | null;
  /** Assigned division IDs (only meaningful for PDs; empty array otherwise). */
  divisions: number[];
}

function toOut(row: AppUser, divisions: number[]): UserOut {
  return {
    userId: row.userId,
    username: row.username,
    fullName: row.fullName,
    role: row.role,
    isActive: row.isActive,
    canCreateProjects: row.canCreateProjects,
    canUpdateProjects: row.canUpdateProjects,
    canDeleteProjects: row.canDeleteProjects,
    canViewProjects: row.canViewProjects,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    lastLogin: row.lastLogin,
    divisions,
  };
}

/** Fetch { userId → divisionIds[] } for a batch of users in one query. */
async function fetchDivisionMap(
  exec: DbExecutor,
  userIds: number[],
): Promise<Map<number, number[]>> {
  const map = new Map<number, number[]>();
  if (userIds.length === 0) return map;
  const rows = await exec
    .select({ userId: userDivision.userId, divisionId: userDivision.divisionId })
    .from(userDivision)
    .where(inArray(userDivision.userId, userIds));
  for (const r of rows) {
    const arr = map.get(r.userId);
    if (arr) arr.push(r.divisionId);
    else map.set(r.userId, [r.divisionId]);
  }
  return map;
}

async function syncUserDivisions(
  exec: DbExecutor,
  userId: number,
  desired: number[],
): Promise<void> {
  const current = await exec
    .select({ divisionId: userDivision.divisionId })
    .from(userDivision)
    .where(eq(userDivision.userId, userId));
  const currentSet = new Set(current.map((r) => r.divisionId));
  const desiredSet = new Set(desired);
  const toAdd    = desired.filter((d) => !currentSet.has(d));
  const toRemove = current.map((r) => r.divisionId).filter((d) => !desiredSet.has(d));
  if (toAdd.length > 0) {
    await exec.insert(userDivision).values(toAdd.map((divisionId) => ({ userId, divisionId })));
  }
  if (toRemove.length > 0) {
    await exec
      .delete(userDivision)
      .where(and(eq(userDivision.userId, userId), inArray(userDivision.divisionId, toRemove)));
  }
}

/** Actor role decides scope. Admin sees Viewer + PD users. MD sees everyone. */
export async function listUsers(actor: AuditActor): Promise<UserOut[]> {
  const allRows = await db.select().from(appUser).orderBy(appUser.username);
  const scoped = actor.role === 'Admin'
    ? allRows.filter((r) => r.role === 'Viewer' || r.role === 'PD')
    : allRows; // MD sees everyone
  const divisionMap = await fetchDivisionMap(db, scoped.map((r) => r.userId));
  return scoped.map((r) => toOut(r, divisionMap.get(r.userId) ?? []));
}

export async function createUser(input: CreateUserInput, actor: AuditActor): Promise<UserOut> {
  // Admin can create Viewer or PD. MD can create any role.
  if (actor.role === 'Admin' && input.role !== 'Viewer' && input.role !== 'PD') {
    throw new HttpError(
      403,
      'ADMIN_CANNOT_ELEVATE',
      "Admin accounts can only create Viewer or PD users. Ask an MD to create Admin/MD accounts.",
    );
  }
  if (actor.role !== 'Admin' && actor.role !== 'MD') {
    throw new HttpError(403, 'FORBIDDEN', 'Only MD or Admin can create users');
  }
  if (input.role === 'PD' && (!input.divisions || input.divisions.length === 0)) {
    throw new HttpError(
      400,
      'PD_REQUIRES_DIVISIONS',
      'Project Director accounts must be assigned at least one division.',
    );
  }

  const passwordHash = await hashPassword(input.password);

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(appUser)
      .where(eq(appUser.username, input.username))
      .limit(1);
    if (existing) {
      throw new HttpError(409, 'USERNAME_TAKEN', `Username ${input.username} already exists`);
    }
    // MD/Admin default to all CRUD on. Viewer/PD default to off unless explicit.
    const defaultFlags = input.role === 'Viewer' || input.role === 'PD' ? false : true;
    const [row] = await tx
      .insert(appUser)
      .values({
        username: input.username,
        passwordHash,
        fullName: input.fullName ?? null,
        role: input.role,
        isActive: true,
        canCreateProjects: input.canCreateProjects ?? defaultFlags,
        canUpdateProjects: input.canUpdateProjects ?? defaultFlags,
        canDeleteProjects: input.canDeleteProjects ?? defaultFlags,
        canViewProjects:   input.canViewProjects ?? true,
        createdBy: actor.userId,
      })
      .returning();
    if (!row) throw new Error('app_user insert returned no row');

    if (input.divisions && input.divisions.length > 0) {
      await tx.insert(userDivision).values(
        input.divisions.map((divisionId) => ({ userId: row.userId, divisionId })),
      );
    }

    await recordAudit(tx, {
      actor,
      action: 'Created',
      projectId: null,
      projectNameSnapshot: null,
      changes: diffAppUser(
        {},
        {
          table: 'app_user',
          userId: row.userId,
          username: row.username,
          fullName: row.fullName,
          role: row.role,
          isActive: row.isActive,
          canCreateProjects: row.canCreateProjects,
          canUpdateProjects: row.canUpdateProjects,
          canDeleteProjects: row.canDeleteProjects,
          canViewProjects: row.canViewProjects,
          divisions: input.divisions ?? [],
        },
      ),
    });
    return toOut(row, input.divisions ?? []);
  });
}

export async function updateUser(
  userId: number,
  input: UpdateUserInput,
  actor: AuditActor,
): Promise<UserOut> {
  return db.transaction(async (tx) => {
    const [pre] = await tx.select().from(appUser).where(eq(appUser.userId, userId)).limit(1);
    if (!pre) throw new HttpError(404, 'USER_NOT_FOUND', `User ${userId} does not exist`);

    // Admin scope enforcement: Admin can only touch Viewer + PD.
    if (actor.role === 'Admin') {
      if (pre.role !== 'Viewer' && pre.role !== 'PD') {
        throw new HttpError(
          403,
          'ADMIN_CANNOT_EDIT_HIGHER',
          "Admin accounts can only edit Viewer or PD users.",
        );
      }
      // Admins may not promote to MD/Admin.
      if (input.role !== undefined && input.role !== 'Viewer' && input.role !== 'PD') {
        throw new HttpError(
          403,
          'ADMIN_CANNOT_ELEVATE',
          "Admin cannot promote a user to Admin/MD. Ask an MD.",
        );
      }
    } else if (actor.role !== 'MD') {
      throw new HttpError(403, 'FORBIDDEN', 'Only MD or Admin can update users');
    }

    // Guard against an MD deactivating themselves and locking the org out.
    if (actor.userId === userId && input.isActive === false) {
      throw new HttpError(400, 'CANNOT_DEACTIVATE_SELF', "You can't deactivate your own account.");
    }

    const patch: Partial<AppUser> = {};
    if (input.fullName !== undefined) patch.fullName = input.fullName;
    if (input.role !== undefined) patch.role = input.role;
    if (input.isActive !== undefined) patch.isActive = input.isActive;
    if (input.password !== undefined) patch.passwordHash = await hashPassword(input.password);
    if (input.canCreateProjects !== undefined) patch.canCreateProjects = input.canCreateProjects;
    if (input.canUpdateProjects !== undefined) patch.canUpdateProjects = input.canUpdateProjects;
    if (input.canDeleteProjects !== undefined) patch.canDeleteProjects = input.canDeleteProjects;
    if (input.canViewProjects   !== undefined) patch.canViewProjects   = input.canViewProjects;

    let post = pre;
    if (Object.keys(patch).length > 0) {
      const [next] = await tx.update(appUser).set(patch).where(eq(appUser.userId, userId)).returning();
      if (!next) throw new Error('app_user update returned no row');
      post = next;
    }

    // Sync division assignments if the caller supplied a divisions array. If
    // the final effective role is PD, enforce ≥ 1 division.
    const finalRole = patch.role ?? pre.role;
    const preDivisions = (await fetchDivisionMap(tx, [userId])).get(userId) ?? [];
    let postDivisions = preDivisions;
    if (input.divisions !== undefined) {
      if (finalRole === 'PD' && input.divisions.length === 0) {
        throw new HttpError(
          400,
          'PD_REQUIRES_DIVISIONS',
          'Project Director accounts must be assigned at least one division.',
        );
      }
      await syncUserDivisions(tx, userId, input.divisions);
      postDivisions = input.divisions;
    } else if (patch.role === 'PD' && preDivisions.length === 0) {
      // Promoting an existing user to PD without providing divisions is invalid.
      throw new HttpError(
        400,
        'PD_REQUIRES_DIVISIONS',
        'Promoting to Project Director requires at least one division assignment.',
      );
    }

    const before: Record<string, unknown> = { table: 'app_user', userId };
    const after: Record<string, unknown> = { table: 'app_user', userId };
    for (const k of Object.keys(patch) as Array<keyof AppUser>) {
      if (k === 'passwordHash') {
        before.passwordChanged = 'previous';
        after.passwordChanged = 'updated';
        continue;
      }
      before[k] = (pre as unknown as Record<string, unknown>)[k];
      after[k] = (post as unknown as Record<string, unknown>)[k];
    }
    if (input.divisions !== undefined) {
      before.divisions = preDivisions;
      after.divisions  = postDivisions;
    }

    const changes = diffAppUser(before, after);
    if (changes.length > 0) {
      await recordAudit(tx, {
        actor,
        action: 'Updated',
        projectId: null,
        projectNameSnapshot: null,
        changes,
      });
    }
    return toOut(post, postDivisions);
  });
}
