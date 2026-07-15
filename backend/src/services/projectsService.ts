import { and, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db } from '../db/client.js';
import { auditLog, division, minutesOfMeeting, project, projectScheme } from '../db/schema.js';
import type { Project } from '../db/schema.js';
import { vProjectEffectivePhysical } from '../db/views.js';
import { recordAudit, type AuditActor, type DbExecutor } from '../lib/audit.js';
import { diffProject } from '../lib/auditLabels.js';
import { toNumberOrNull } from '../lib/numbers.js';
import { decodeCursor, encodeCursor } from '../lib/pagination.js';
import type { CreateProjectInput, UpdateProjectInput } from '../lib/projectFields.js';
import { HttpError } from '../middleware/errorHandler.js';

const NUMERIC_KEYS = [
  'sanctionedCostCr',
  'aaAmountCr',
  'revisedAaAmountCr',
  'agreementAmountCr',
  'physicalProgressPct',
  'financialProgressCr',
  'financialProgressPct',
  'scheduledProgressPct',
  'contractValueCr',
  'mobAdvanceIssuedCr',
  'mobAdvanceRecoveredCr',
  'advanceOutstandingCr',
  'retentionMoneyHeldCr',
  'pbgAmountCr',
  'emdAmountCr',
  'totalPaymentsCr',
  'fundReceivedCr',
  'omPeriodMonths',
] as const satisfies readonly (keyof Project)[];

type NumericKey = (typeof NUMERIC_KEYS)[number];

type Numified<T> = {
  [K in keyof T]: K extends NumericKey ? number | null : T[K];
};

function numify<T extends Project>(row: T): Numified<T> {
  const out = { ...row } as Record<string, unknown>;
  for (const k of NUMERIC_KEYS) {
    out[k] = toNumberOrNull(row[k] as string | null);
  }
  return out as Numified<T>;
}

/* ============================================================
 * LIST
 * ============================================================ */

export const listProjectsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  /** Filters on the new project_stage_v2 column (Phase A §3.2). */
  projectStage: z.string().min(1).optional(),
  contractType: z.string().min(1).optional(),
  districtId: z.coerce.number().int().positive().optional(),
  divisionId: z.coerce.number().int().positive().optional(),
  regionId: z.coerce.number().int().positive().optional(),
  sectorId: z.coerce.number().int().positive().optional(),
  schemeId: z.coerce.number().int().positive().optional(),
  search: z.string().min(1).max(200).optional(),
});
export type ListProjectsQuery = z.infer<typeof listProjectsQuery>;

export interface ProjectListItem extends Numified<Project> {
  effectivePhysicalPct: number | null;
  isMilestoneWeighted: boolean | null;
  schemes: number[];
}

export async function listProjects(
  q: ListProjectsQuery,
): Promise<{ items: ProjectListItem[]; nextCursor: string | null }> {
  const filters = [] as ReturnType<typeof eq>[];
  if (q.status) filters.push(eq(project.status, q.status));
  // Phase A §3.2 — the UI's "Project Stage" filter targets the new column.
  if (q.projectStage) filters.push(eq(project.projectStageV2, q.projectStage));
  if (q.contractType) filters.push(eq(project.contractType, q.contractType));
  if (q.districtId) filters.push(eq(project.districtId, q.districtId));
  if (q.divisionId) filters.push(eq(project.divisionId, q.divisionId));
  if (q.sectorId) filters.push(eq(project.sectorId, q.sectorId));

  if (q.cursor) {
    const c = decodeCursor(q.cursor);
    filters.push(
      or(
        lt(project.createdAt, new Date(c.createdAt)),
        and(eq(project.createdAt, new Date(c.createdAt)), lt(project.projectId, c.id)),
      )!,
    );
  }

  // Region filter: pass through to project.divisionId via a subquery join,
  // since the project table has no region_id column of its own.
  const regionClause = q.regionId
    ? sql`${project.divisionId} IN (SELECT ${division.divisionId} FROM ${division}
                                    WHERE ${division.regionId} = ${q.regionId})`
    : undefined;

  const searchClause = q.search
    ? sql`(${project.projectName} ILIKE ${'%' + q.search + '%'} OR ${project.projectId} = ${q.search})`
    : undefined;

  const schemeJoin = q.schemeId
    ? sql`EXISTS (SELECT 1 FROM ${projectScheme} ps
                  WHERE ps.project_id = ${project.projectId}
                    AND ps.scheme_id = ${q.schemeId})`
    : undefined;

  const whereClauses = [...filters, searchClause, schemeJoin, regionClause].filter(
    (c): c is NonNullable<typeof c> => c !== undefined,
  );

  const rows = await db
    .select({
      p: project,
      effectivePhysicalPct: vProjectEffectivePhysical.physicalProgressPct,
      isMilestoneWeighted: vProjectEffectivePhysical.isMilestoneWeighted,
    })
    .from(project)
    .leftJoin(vProjectEffectivePhysical, eq(vProjectEffectivePhysical.projectId, project.projectId))
    .where(whereClauses.length > 0 ? and(...whereClauses) : undefined)
    .orderBy(desc(project.createdAt), desc(project.projectId))
    .limit(q.limit + 1);

  const pageRows = rows.slice(0, q.limit);
  const pageIds = pageRows.map((r) => r.p.projectId);

  const schemeRows = pageIds.length > 0
    ? await db
        .select({ projectId: projectScheme.projectId, schemeId: projectScheme.schemeId })
        .from(projectScheme)
        .where(inArray(projectScheme.projectId, pageIds))
    : [];
  const schemesByProject = new Map<string, number[]>();
  for (const row of schemeRows) {
    const list = schemesByProject.get(row.projectId);
    if (list) list.push(row.schemeId);
    else schemesByProject.set(row.projectId, [row.schemeId]);
  }

  const items = pageRows.map((row) => ({
    ...numify(row.p),
    effectivePhysicalPct: toNumberOrNull(row.effectivePhysicalPct),
    isMilestoneWeighted: row.isMilestoneWeighted,
    schemes: schemesByProject.get(row.p.projectId) ?? [],
  }));

  let nextCursor: string | null = null;
  if (rows.length > q.limit) {
    const last = items[items.length - 1];
    if (last?.createdAt) {
      nextCursor = encodeCursor({
        createdAt: last.createdAt.toISOString(),
        id: last.projectId,
      });
    }
  }

  return { items, nextCursor };
}

/* ============================================================
 * DETAIL
 * ============================================================ */

export interface ProjectDetail extends Numified<Project> {
  effectivePhysicalPct: number | null;
  isMilestoneWeighted: boolean | null;
  schemes: number[];
}

export async function getProject(projectId: string): Promise<ProjectDetail> {
  const [row] = await db
    .select({
      p: project,
      effectivePhysicalPct: vProjectEffectivePhysical.physicalProgressPct,
      isMilestoneWeighted: vProjectEffectivePhysical.isMilestoneWeighted,
    })
    .from(project)
    .leftJoin(vProjectEffectivePhysical, eq(vProjectEffectivePhysical.projectId, project.projectId))
    .where(eq(project.projectId, projectId))
    .limit(1);

  if (!row) {
    throw new HttpError(404, 'PROJECT_NOT_FOUND', `Project ${projectId} does not exist`);
  }

  const schemeRows = await db
    .select({ schemeId: projectScheme.schemeId })
    .from(projectScheme)
    .where(eq(projectScheme.projectId, projectId));

  return {
    ...numify(row.p),
    effectivePhysicalPct: toNumberOrNull(row.effectivePhysicalPct),
    isMilestoneWeighted: row.isMilestoneWeighted,
    schemes: schemeRows.map((s) => s.schemeId),
  };
}

/* ============================================================
 * WRITES
 * ============================================================ */

async function fetchProjectSchemes(exec: DbExecutor, projectId: string): Promise<number[]> {
  const rows = await exec
    .select({ schemeId: projectScheme.schemeId })
    .from(projectScheme)
    .where(eq(projectScheme.projectId, projectId));
  return rows.map((r) => r.schemeId);
}

async function syncProjectSchemes(
  exec: DbExecutor,
  projectId: string,
  desired: number[],
): Promise<void> {
  const current = await fetchProjectSchemes(exec, projectId);
  const currentSet = new Set(current);
  const desiredSet = new Set(desired);
  const toAdd = desired.filter((s) => !currentSet.has(s));
  const toRemove = current.filter((s) => !desiredSet.has(s));
  if (toAdd.length > 0) {
    await exec.insert(projectScheme).values(toAdd.map((schemeId) => ({ projectId, schemeId })));
  }
  if (toRemove.length > 0) {
    await exec
      .delete(projectScheme)
      .where(
        and(eq(projectScheme.projectId, projectId), inArray(projectScheme.schemeId, toRemove)),
      );
  }
}

function stripSchemesFromPatch(input: CreateProjectInput | UpdateProjectInput): {
  schemes: number[] | undefined;
  fields: Record<string, unknown>;
} {
  const { schemes, ...rest } = input;
  return { schemes, fields: rest };
}

export async function createProject(input: CreateProjectInput, actor: AuditActor): Promise<ProjectDetail> {
  const projectId = randomUUID();
  const { schemes, fields } = stripSchemesFromPatch(input);

  await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(project)
      .values({ ...(fields as Partial<Project>), projectId, projectName: input.projectName })
      .returning();
    if (!inserted) throw new Error('project insert did not return a row');

    if (schemes && schemes.length > 0) {
      await tx.insert(projectScheme).values(schemes.map((schemeId) => ({ projectId, schemeId })));
    }

    const changes = diffProject({}, {
      ...(inserted as unknown as Record<string, unknown>),
      schemes: schemes ?? [],
    });

    await recordAudit(tx, {
      actor,
      action: 'Created',
      projectId,
      projectNameSnapshot: inserted.projectName,
      changes,
    });
  });

  return getProject(projectId);
}

export async function updateProject(
  projectId: string,
  input: UpdateProjectInput,
  actor: AuditActor,
): Promise<ProjectDetail> {
  const { schemes, fields } = stripSchemesFromPatch(input);
  const patch = fields as Partial<Project>;
  const patchKeys = Object.keys(patch);

  const post = await db.transaction(async (tx) => {
    const [pre] = await tx.select().from(project).where(eq(project.projectId, projectId)).limit(1);
    if (!pre) {
      throw new HttpError(404, 'PROJECT_NOT_FOUND', `Project ${projectId} does not exist`);
    }
    const preSchemes = await fetchProjectSchemes(tx, projectId);

    let updated: Project = pre;
    if (patchKeys.length > 0) {
      const [next] = await tx
        .update(project)
        .set(patch)
        .where(eq(project.projectId, projectId))
        .returning();
      if (!next) throw new Error('project update did not return a row');
      updated = next;
    }

    let postSchemes = preSchemes;
    if (schemes !== undefined) {
      await syncProjectSchemes(tx, projectId, schemes);
      postSchemes = schemes;
    }

    const before: Record<string, unknown> = {
      ...(pre as unknown as Record<string, unknown>),
      schemes: preSchemes,
    };
    const after: Record<string, unknown> = {
      ...(updated as unknown as Record<string, unknown>),
      schemes: postSchemes,
    };
    // Only audit fields the caller actually supplied — a PATCH omitting a
    // field is "no change", so we shouldn't audit unchanged rows just
    // because their string representation drifted (e.g. numeric formatting).
    const scopedBefore: Record<string, unknown> = {};
    const scopedAfter: Record<string, unknown> = {};
    for (const key of patchKeys) {
      scopedBefore[key] = before[key];
      scopedAfter[key] = after[key];
    }
    if (schemes !== undefined) {
      scopedBefore.schemes = before.schemes;
      scopedAfter.schemes = after.schemes;
    }

    const changes = diffProject(scopedBefore, scopedAfter);

    if (changes.length > 0) {
      await recordAudit(tx, {
        actor,
        action: 'Updated',
        projectId,
        projectNameSnapshot: updated.projectName,
        changes,
      });
    }

    return updated;
  });

  return getProject(post.projectId);
}

export async function deleteProject(projectId: string, actor: AuditActor): Promise<void> {
  await db.transaction(async (tx) => {
    const [pre] = await tx.select().from(project).where(eq(project.projectId, projectId)).limit(1);
    if (!pre) {
      throw new HttpError(404, 'PROJECT_NOT_FOUND', `Project ${projectId} does not exist`);
    }
    const preSchemes = await fetchProjectSchemes(tx, projectId);

    // audit_log + minutes_of_meeting FKs are ON DELETE SET NULL (0002_relax_project_fks.sql);
    // Postgres handles the nulling automatically at DELETE time.
    void auditLog;
    void minutesOfMeeting;

    await recordAudit(tx, {
      actor,
      action: 'Deleted',
      projectId,
      projectNameSnapshot: pre.projectName,
      changes: diffProject(
        {
          ...(pre as unknown as Record<string, unknown>),
          schemes: preSchemes,
        },
        {},
      ),
    });

    await tx.delete(project).where(eq(project.projectId, projectId));
  });
}

export const projectIdParamSchema = z.object({ projectId: z.string().uuid() });
