/**
 * Audit-log helpers.
 *
 * Every write in the API records to audit_log + audit_log_change from
 * inside the same transaction as the entity write, so a partial failure
 * rolls back both. `diffFields` compares pre-image and post-image
 * objects and emits an AuditChange row for every field that actually
 * changed (skipping bookkeeping columns like createdAt/lastUpdated).
 */

import { db } from '../db/client.js';
import type { UserRole } from '../db/enums.js';
import { auditLog, auditLogChange } from '../db/schema.js';
import type { AuditAction } from '../db/enums.js';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbExecutor = typeof db | Tx;

export interface AuditActor {
  userId: number | null;
  username: string;
  role: UserRole;
}

export interface AuditChange {
  fieldKey: string;
  fieldLabel?: string | null;
  beforeValue: string | null;
  afterValue: string | null;
}

export interface AuditRecordInput {
  actor: AuditActor;
  action: AuditAction;
  projectId: string | null;
  projectNameSnapshot?: string | null;
  changes: AuditChange[];
}

const NON_AUDITED_KEYS = new Set([
  'createdAt',
  'lastUpdated',
  'passwordHash',
  'tokenHash',
  'issuedAt',
  'expiresAt',
  'revokedAt',
  'replacedBy',
  'userAgent',
  'ipAddress',
]);

function stringify(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
  return JSON.stringify(v);
}

/**
 * Compare two flat row-like objects and return the fields that changed.
 * For creates, pass `{}` as `before`. For deletes, pass `{}` as `after`.
 *
 * `labels` — optional lookup from `fieldKey` to a human-readable label
 * (see lib/auditLabels.ts). Values land in `audit_log_change.field_label`
 * so the audit-trail UI can render them directly.
 */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  labels?: Record<string, string>,
): AuditChange[] {
  const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
  const out: AuditChange[] = [];
  for (const k of keys) {
    if (NON_AUDITED_KEYS.has(k)) continue;
    const b = stringify(before[k]);
    const a = stringify(after[k]);
    if (b !== a) {
      out.push({
        fieldKey: k,
        fieldLabel: labels?.[k] ?? null,
        beforeValue: b,
        afterValue: a,
      });
    }
  }
  return out;
}

export async function recordAudit(exec: DbExecutor, input: AuditRecordInput): Promise<number> {
  const [inserted] = await exec
    .insert(auditLog)
    .values({
      projectId: input.projectId,
      userId: input.actor.userId,
      userLabel: input.actor.username,
      roleLabel: input.actor.role,
      action: input.action,
      projectNameSnapshot: input.projectNameSnapshot ?? null,
    })
    .returning({ auditId: auditLog.auditId });

  if (!inserted) {
    throw new Error('audit_log insert did not return an id');
  }

  if (input.changes.length > 0) {
    await exec.insert(auditLogChange).values(
      input.changes.map((c) => ({
        auditId: inserted.auditId,
        fieldKey: c.fieldKey,
        fieldLabel: c.fieldLabel ?? null,
        beforeValue: c.beforeValue,
        afterValue: c.afterValue,
      })),
    );
  }

  return inserted.auditId;
}
