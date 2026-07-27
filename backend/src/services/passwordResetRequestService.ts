import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Request } from 'express';
import { db } from '../db/client.js';
import type { UserRole } from '../db/enums.js';
import { appUser, passwordResetRequest } from '../db/schema.js';
import { recordAudit, type DbExecutor } from '../lib/audit.js';
import { diffPasswordResetRequest } from '../lib/auditLabels.js';
import { APPROVER_ROLES } from '../lib/roleHierarchy.js';
import { HttpError } from '../middleware/errorHandler.js';
import type { OtpChannel } from './passwordResetService.js';

export type RequestStatus = 'Pending' | 'Approved' | 'Completed';

function requestFingerprint(req: Request): { userAgent: string | null; ip: string | null } {
  return { userAgent: req.get('user-agent') ?? null, ip: req.ip ?? null };
}

/** Active users in the given role's eligible-approver roles who have an email on file. Used both to decide a new request's initial status and to know who sendOtp should deliver the code to. */
export async function getEligibleApproverEmails(role: UserRole): Promise<string[]> {
  const eligibleRoles = APPROVER_ROLES[role];
  if (eligibleRoles.length === 0) return [];

  const rows = await db
    .select({ email: appUser.email, isActive: appUser.isActive })
    .from(appUser)
    .where(inArray(appUser.role, eligibleRoles));

  return rows.filter((r) => r.isActive && r.email).map((r) => r.email as string);
}

export interface CreateRequestResult {
  /** True once an eligible approver was found and the OTP was actually dispatched. */
  otpSent: boolean;
}

/**
 * Submits a password-reset request for a non-MD user. There is no
 * separate human approval step — if at least one eligible approver has
 * an email on file, the request resolves to 'Approved' immediately and
 * the caller (the /auth/password-reset-requests route) fires the OTP to
 * them right away via passwordResetService.sendOtp. If nobody eligible
 * has contact info on file, the row stays 'Pending' and the requester
 * sees a "contact your administrator" message instead of an OTP screen.
 *
 * Silently no-ops (no throw, otpSent: false) if the user doesn't exist,
 * is inactive, or is MD — same enumeration-safety/defense-in-depth
 * reasoning as passwordResetService's other no-throw paths. A genuine
 * duplicate-active-request attempt surfaces as a real 409, since by this
 * point the frontend has already confirmed the account exists via the
 * identify step.
 */
export async function createRequest(
  username: string,
  channel: OtpChannel,
  req: Request,
): Promise<CreateRequestResult> {
  const [user] = await db.select().from(appUser).where(eq(appUser.username, username)).limit(1);
  if (!user || !user.isActive || user.role === 'MD') return { otpSent: false };

  const role = user.role as UserRole;
  const { userAgent, ip } = requestFingerprint(req);
  const recipients = await getEligibleApproverEmails(role);
  const status: RequestStatus = recipients.length > 0 ? 'Approved' : 'Pending';

  let inserted;
  try {
    [inserted] = await db
      .insert(passwordResetRequest)
      .values({ userId: user.userId, role, channel, status, userAgent, ipAddress: ip })
      .returning();
  } catch (err) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      throw new HttpError(409, 'DUPLICATE_REQUEST', 'You already have an active password reset request.');
    }
    throw err;
  }
  if (!inserted) throw new Error('password_reset_request insert returned no row');

  await recordAudit(db, {
    actor: { userId: user.userId, username: user.username, role },
    action: 'Created',
    projectId: null,
    projectNameSnapshot: null,
    changes: diffPasswordResetRequest(
      {},
      {
        table: 'password_reset_request',
        requestId: inserted.requestId,
        userId: user.userId,
        role,
        channel,
        status,
      },
    ),
  });

  return { otpSent: status === 'Approved' };
}

export interface RequestPasswordResetStatus {
  status: 'none' | 'pending' | 'approved';
  channel: OtpChannel | null;
}

/** Latest request drives the Forgot Password UI's state for non-MD users. A Completed row is treated as 'none' so a fresh request can be submitted. */
export async function getLatestRequestStatus(userId: number): Promise<RequestPasswordResetStatus> {
  const [row] = await db
    .select()
    .from(passwordResetRequest)
    .where(eq(passwordResetRequest.userId, userId))
    .orderBy(desc(passwordResetRequest.requestedAt))
    .limit(1);

  if (!row || row.status === 'Completed') return { status: 'none', channel: null };
  if (row.status === 'Pending') return { status: 'pending', channel: null };
  return { status: 'approved', channel: row.channel as OtpChannel };
}

/** The authorization gate for non-MD OTP issuance — see passwordResetService.sendOtp. */
export async function hasApprovedRequest(userId: number, channel: OtpChannel): Promise<boolean> {
  const [row] = await db
    .select({ requestId: passwordResetRequest.requestId })
    .from(passwordResetRequest)
    .where(
      and(
        eq(passwordResetRequest.userId, userId),
        eq(passwordResetRequest.status, 'Approved'),
        eq(passwordResetRequest.channel, channel),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** Called from passwordResetService.resetPassword's transaction once the password actually changes. */
export async function completeApprovedRequest(exec: DbExecutor, userId: number): Promise<void> {
  await exec
    .update(passwordResetRequest)
    .set({ status: 'Completed', fulfilledAt: new Date() })
    .where(and(eq(passwordResetRequest.userId, userId), eq(passwordResetRequest.status, 'Approved')));
}
