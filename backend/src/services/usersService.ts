import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { userRoles } from '../db/enums.js';
import type { AppUser } from '../db/schema.js';
import { appUser } from '../db/schema.js';
import { recordAudit, type AuditActor } from '../lib/audit.js';
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
  createdBy: number | null;
  createdAt: Date | null;
  lastLogin: Date | null;
}

function toOut(row: AppUser): UserOut {
  return {
    userId: row.userId,
    username: row.username,
    fullName: row.fullName,
    role: row.role,
    isActive: row.isActive,
    canCreateProjects: row.canCreateProjects,
    canUpdateProjects: row.canUpdateProjects,
    canDeleteProjects: row.canDeleteProjects,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    lastLogin: row.lastLogin,
  };
}

/** Actor role decides scope. Admin only sees Viewer users. */
export async function listUsers(actor: AuditActor): Promise<UserOut[]> {
  const rows = await db.select().from(appUser).orderBy(appUser.username);
  if (actor.role === 'Admin') {
    return rows.filter((r) => r.role === 'Viewer').map(toOut);
  }
  // MD: everyone
  return rows.map(toOut);
}

export async function createUser(input: CreateUserInput, actor: AuditActor): Promise<UserOut> {
  // Admin can only create Viewers. MD can create any role.
  if (actor.role === 'Admin' && input.role !== 'Viewer') {
    throw new HttpError(
      403,
      'ADMIN_CANNOT_ELEVATE',
      "Admin accounts can only create Viewer users. Ask an MD to create Admin/MD accounts.",
    );
  }
  if (actor.role !== 'Admin' && actor.role !== 'MD') {
    throw new HttpError(403, 'FORBIDDEN', 'Only MD or Admin can create users');
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
    // MD role gets all-flags-on by default; Admin similarly; Viewer defaults to
    // false unless caller opts in.
    const defaultFlags = input.role === 'Viewer' ? false : true;
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
        createdBy: actor.userId,
      })
      .returning();
    if (!row) throw new Error('app_user insert returned no row');

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
        },
      ),
    });
    return toOut(row);
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

    // Admin scope enforcement
    if (actor.role === 'Admin') {
      if (pre.role !== 'Viewer') {
        throw new HttpError(
          403,
          'ADMIN_CANNOT_EDIT_HIGHER',
          "Admin accounts can only edit Viewer users.",
        );
      }
      // Admins may not promote a Viewer to a higher role.
      if (input.role !== undefined && input.role !== 'Viewer') {
        throw new HttpError(
          403,
          'ADMIN_CANNOT_ELEVATE',
          "Admin cannot promote a Viewer to Admin/MD. Ask an MD.",
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

    let post = pre;
    if (Object.keys(patch).length > 0) {
      const [next] = await tx.update(appUser).set(patch).where(eq(appUser.userId, userId)).returning();
      if (!next) throw new Error('app_user update returned no row');
      post = next;
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
    return toOut(post);
  });
}
