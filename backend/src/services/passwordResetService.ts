import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Request } from 'express';
import { db } from '../db/client.js';
import type { UserRole } from '../db/enums.js';
import { appUser, passwordResetOtp, refreshToken } from '../db/schema.js';
import { recordAudit } from '../lib/audit.js';
import { diffAppUser } from '../lib/auditLabels.js';
import { sendApprovalRequestEmail, sendOtpEmail, sendOtpSms } from '../lib/mailer.js';
import {
  generateOtp,
  hashOtp,
  maskEmail,
  maskMobile,
  parseResetToken,
  signResetToken,
  verifyOtp as compareOtp,
  verifyResetToken,
} from '../lib/otp.js';
import { hashPassword } from '../lib/passwords.js';
import { approverRolesLabel } from '../lib/roleHierarchy.js';
import { HttpError } from '../middleware/errorHandler.js';
import * as requestService from './passwordResetRequestService.js';

export type OtpChannel = 'email' | 'mobile';

const OTP_TTL_MS = 5 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

/** Same generic message for every "code didn't work" case — don't help an attacker distinguish wrong-code from no-such-user/no-such-OTP. */
const INVALID_OTP_MESSAGE = 'Invalid or expired code';
const INVALID_RESET_TOKEN_MESSAGE = 'Invalid or expired reset link. Please start the process again.';

function requestFingerprint(req: Request): { userAgent: string | null; ip: string | null } {
  return { userAgent: req.get('user-agent') ?? null, ip: req.ip ?? null };
}

export interface RequestPasswordResetResult {
  found: boolean;
  /** Only MD self-serves directly; every other role goes through the request/approval workflow. */
  selfService: boolean;
  maskedEmail: string | null;
  maskedMobile: string | null;
  /** Present only when found && !selfService — drives the non-MD Forgot Password UI state. */
  requestStatus?: 'none' | 'pending' | 'approved';
  /** Present only when requestStatus === 'approved' — the channel fixed at request-submission time. */
  channel?: OtpChannel;
  /** Present only when found && !selfService — e.g. "MD, Admin, or PD". */
  approverRolesLabel?: string;
}

/**
 * Looks up the user but always returns a uniformly-shaped result — the
 * caller (route) responds 200 either way. `found: false` carries no
 * masked contact info, so the UI simply doesn't progress to the method
 * picker; there's no distinct error status/shape an attacker could use
 * to enumerate valid usernames (Task 10).
 */
export async function requestPasswordReset(username: string): Promise<RequestPasswordResetResult> {
  const [user] = await db.select().from(appUser).where(eq(appUser.username, username)).limit(1);
  if (!user || !user.isActive) {
    return { found: false, selfService: false, maskedEmail: null, maskedMobile: null };
  }

  const role = user.role as UserRole;
  const maskedEmail = user.email ? maskEmail(user.email) : null;
  const maskedMobile = user.mobileNumber ? maskMobile(user.mobileNumber) : null;

  if (role === 'MD') {
    return { found: true, selfService: true, maskedEmail, maskedMobile };
  }

  const { status, channel } = await requestService.getLatestRequestStatus(user.userId);
  return {
    found: true,
    selfService: false,
    maskedEmail,
    maskedMobile,
    requestStatus: status,
    ...(channel ? { channel } : {}),
    approverRolesLabel: approverRolesLabel(role),
  };
}

/**
 * Generates + delivers an OTP. Silently no-ops (no throw) if the user
 * doesn't exist, is inactive, or has no contact info for the requested
 * channel — same enumeration-safety reasoning as requestPasswordReset.
 * Rate limiting (route layer) is what actually bounds abuse here.
 */
export async function sendOtp(username: string, channel: OtpChannel, req: Request): Promise<void> {
  const [user] = await db.select().from(appUser).where(eq(appUser.username, username)).limit(1);
  if (!user || !user.isActive) return;

  const role = user.role as UserRole;

  // Non-MD roles can't self-serve — an OTP only ever gets issued once an
  // eligible approver exists for an active request (Priority 2/6), and it
  // is delivered to the approver(s) rather than the requester: the OTP
  // itself is the approval, relayed out of band. Everything below this
  // recipient-resolution step is the exact same OTP machinery MD uses.
  let approverEmails: string[] = [];
  if (role !== 'MD') {
    const approved = await requestService.hasApprovedRequest(user.userId, channel);
    if (!approved) return;
    approverEmails = await requestService.getEligibleApproverEmails(role);
    if (approverEmails.length === 0) return;
  } else {
    const contact = channel === 'email' ? user.email : user.mobileNumber;
    if (!contact) return;
  }

  // Invalidate any previous unconsumed OTP for this user+channel so only
  // the newest one is ever valid.
  await db
    .update(passwordResetOtp)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(passwordResetOtp.userId, user.userId),
        eq(passwordResetOtp.channel, channel),
        isNull(passwordResetOtp.consumedAt),
      ),
    );

  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  const { userAgent, ip } = requestFingerprint(req);

  await db.insert(passwordResetOtp).values({
    userId: user.userId,
    channel,
    otpHash,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    userAgent,
    ipAddress: ip,
  });

  if (role !== 'MD') {
    await Promise.all(
      approverEmails.map((email) =>
        sendApprovalRequestEmail(email, user.username, role, otp).catch(() => {
          process.stderr.write('warn: failed to send approval-request OTP email\n');
        }),
      ),
    );
    return;
  }

  const contact = (channel === 'email' ? user.email : user.mobileNumber) as string;
  if (channel === 'email') {
    await sendOtpEmail(contact, otp);
  } else {
    sendOtpSms(contact, otp);
  }
}

export interface VerifyOtpResult {
  resetToken: string;
}

export async function verifyOtp(
  username: string,
  channel: OtpChannel,
  code: string,
): Promise<VerifyOtpResult> {
  const [user] = await db.select().from(appUser).where(eq(appUser.username, username)).limit(1);
  if (!user || !user.isActive) {
    throw new HttpError(400, 'INVALID_OTP', INVALID_OTP_MESSAGE);
  }

  const [otpRow] = await db
    .select()
    .from(passwordResetOtp)
    .where(
      and(
        eq(passwordResetOtp.userId, user.userId),
        eq(passwordResetOtp.channel, channel),
        isNull(passwordResetOtp.consumedAt),
      ),
    )
    .orderBy(desc(passwordResetOtp.createdAt))
    .limit(1);

  if (!otpRow) {
    throw new HttpError(400, 'INVALID_OTP', INVALID_OTP_MESSAGE);
  }
  if (otpRow.expiresAt.getTime() <= Date.now()) {
    throw new HttpError(400, 'OTP_EXPIRED', 'This code has expired. Request a new one.');
  }
  if (otpRow.attempts >= MAX_OTP_ATTEMPTS) {
    throw new HttpError(429, 'OTP_LOCKED', 'Too many incorrect attempts. Request a new code.');
  }

  const ok = await compareOtp(code, otpRow.otpHash);
  if (!ok) {
    await db
      .update(passwordResetOtp)
      .set({ attempts: otpRow.attempts + 1 })
      .where(eq(passwordResetOtp.otpId, otpRow.otpId));
    throw new HttpError(400, 'INVALID_OTP', INVALID_OTP_MESSAGE);
  }

  const reset = await signResetToken(otpRow.otpId);
  await db
    .update(passwordResetOtp)
    .set({
      consumedAt: new Date(),
      resetTokenHash: reset.hash,
      resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    })
    .where(eq(passwordResetOtp.otpId, otpRow.otpId));

  return { resetToken: reset.value };
}

export async function resetPassword(
  resetToken: string,
  password: string,
  confirmPassword: string,
): Promise<void> {
  if (password !== confirmPassword) {
    throw new HttpError(400, 'PASSWORD_MISMATCH', 'Passwords do not match');
  }

  let parsed;
  try {
    parsed = parseResetToken(resetToken);
  } catch {
    throw new HttpError(400, 'INVALID_RESET_TOKEN', INVALID_RESET_TOKEN_MESSAGE);
  }

  const [otpRow] = await db
    .select()
    .from(passwordResetOtp)
    .where(eq(passwordResetOtp.otpId, parsed.otpId))
    .limit(1);

  if (!otpRow || !otpRow.resetTokenHash || !otpRow.resetTokenExpiresAt) {
    throw new HttpError(400, 'INVALID_RESET_TOKEN', INVALID_RESET_TOKEN_MESSAGE);
  }
  if (otpRow.resetTokenExpiresAt.getTime() <= Date.now()) {
    throw new HttpError(400, 'INVALID_RESET_TOKEN', INVALID_RESET_TOKEN_MESSAGE);
  }
  const tokenOk = await verifyResetToken(parsed.rawSecret, otpRow.resetTokenHash);
  if (!tokenOk) {
    throw new HttpError(400, 'INVALID_RESET_TOKEN', INVALID_RESET_TOKEN_MESSAGE);
  }

  const [user] = await db.select().from(appUser).where(eq(appUser.userId, otpRow.userId)).limit(1);
  if (!user || !user.isActive) {
    throw new HttpError(400, 'INVALID_RESET_TOKEN', INVALID_RESET_TOKEN_MESSAGE);
  }

  // Same length policy as everywhere else passwords are set (createUserSchema
  // / updateUserSchema in usersService.ts, and hashPassword's own guard).
  if (password.length < 8) {
    throw new HttpError(400, 'WEAK_PASSWORD', 'Password must be at least 8 characters');
  }

  const passwordHash = await hashPassword(password);

  await db.transaction(async (tx) => {
    await tx.update(appUser).set({ passwordHash }).where(eq(appUser.userId, user.userId));

    // Single-use: a reset token can't be replayed once the password changes.
    await tx
      .update(passwordResetOtp)
      .set({ resetTokenHash: null, resetTokenExpiresAt: null })
      .where(eq(passwordResetOtp.otpId, otpRow.otpId));

    // Force re-login everywhere — same revoke-all query authService.refresh()
    // uses when it detects refresh-token reuse.
    await tx
      .update(refreshToken)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshToken.userId, user.userId), isNull(refreshToken.revokedAt)));

    if ((user.role as UserRole) !== 'MD') {
      await requestService.completeApprovedRequest(tx, user.userId);
    }

    await recordAudit(tx, {
      actor: { userId: user.userId, username: user.username, role: user.role as UserRole },
      action: 'Updated',
      projectId: null,
      projectNameSnapshot: null,
      changes: diffAppUser({ passwordChanged: 'previous' }, { passwordChanged: 'updated' }),
    });
  });
}
