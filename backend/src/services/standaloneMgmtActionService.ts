import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { openClosedStatuses } from '../db/enums.js';
import { standaloneManagementAction } from '../db/schema.js';
import type { StandaloneManagementAction } from '../db/schema.js';
import { HttpError } from '../middleware/errorHandler.js';

/**
 * Cross-project management-action topics. These aren't attached to any
 * project row — think portfolio-level to-dos raised in a review meeting.
 * The project-scoped `management_action_item` table still exists (Input
 * Sheet §07) for anything tied to a specific project.
 */

const dateField = () =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .nullable()
    .optional();

export const standaloneActionCreateSchema = z.object({
  topic: z.string().min(1).max(2000),
  status: z.enum(openClosedStatuses).default('Open'),
  deadlineDate: dateField(),
});

export const standaloneActionUpdateSchema = standaloneActionCreateSchema.partial();

export type StandaloneActionCreateInput = z.infer<typeof standaloneActionCreateSchema>;
export type StandaloneActionUpdateInput = z.infer<typeof standaloneActionUpdateSchema>;

export async function listStandaloneActions(): Promise<StandaloneManagementAction[]> {
  return db
    .select()
    .from(standaloneManagementAction)
    .orderBy(desc(standaloneManagementAction.createdAt), desc(standaloneManagementAction.actionId));
}

export async function createStandaloneAction(
  input: StandaloneActionCreateInput,
  createdByUserId: number | null,
): Promise<StandaloneManagementAction> {
  const [row] = await db
    .insert(standaloneManagementAction)
    .values({
      topic: input.topic,
      status: input.status,
      deadlineDate: input.deadlineDate ?? null,
      createdBy: createdByUserId,
    })
    .returning();
  if (!row) throw new Error('standalone_management_action insert did not return a row');
  return row;
}

export async function updateStandaloneAction(
  actionId: number,
  input: StandaloneActionUpdateInput,
): Promise<StandaloneManagementAction> {
  const patchKeys = Object.keys(input);
  if (patchKeys.length === 0) {
    const [pre] = await db
      .select()
      .from(standaloneManagementAction)
      .where(eq(standaloneManagementAction.actionId, actionId))
      .limit(1);
    if (!pre) throw new HttpError(404, 'STANDALONE_ACTION_NOT_FOUND', `Action ${actionId} not found`);
    return pre;
  }
  const [row] = await db
    .update(standaloneManagementAction)
    .set({ ...input, updatedAt: sql`now()` })
    .where(eq(standaloneManagementAction.actionId, actionId))
    .returning();
  if (!row) throw new HttpError(404, 'STANDALONE_ACTION_NOT_FOUND', `Action ${actionId} not found`);
  return row;
}

export async function deleteStandaloneAction(actionId: number): Promise<void> {
  const result = await db
    .delete(standaloneManagementAction)
    .where(eq(standaloneManagementAction.actionId, actionId));
  // Drizzle's pg driver returns { rowCount }. Not-found isn't fatal from
  // the client's POV, but surface a 404 so the UI can toast if needed.
  const affected = (result as unknown as { rowCount?: number }).rowCount ?? 0;
  if (affected === 0) {
    throw new HttpError(404, 'STANDALONE_ACTION_NOT_FOUND', `Action ${actionId} not found`);
  }
}
