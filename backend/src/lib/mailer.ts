/**
 * OTP delivery.
 *
 * Email — real, via SMTP (nodemailer). If SMTP env vars are unset, falls
 * back to logging the OTP server-side instead of throwing, mirroring the
 * graceful degradation already used for Upstash in rateLimit.ts (warn in
 * dev, fatal in prod).
 *
 * SMS — stub only. No SMS gateway is configured yet; sendOtpSms logs the
 * OTP server-side instead of texting it. Swap in a real provider (e.g.
 * Twilio) here when one is chosen — callers don't need to change.
 */

import nodemailer, { type Transporter } from 'nodemailer';
import { env, isProduction } from '../env.js';

const hasSmtp = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

if (!hasSmtp) {
  const msg = isProduction
    ? 'FATAL: SMTP_HOST/USER/PASS missing in production — email OTP will only be logged, not sent.'
    : 'warn: SMTP_HOST/USER/PASS missing — email OTP will be logged instead of sent (dev only).';
  process.stderr.write(`${msg}\n`);
}

let transporter: Transporter | null = null;
function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: (env.SMTP_PORT ?? 587) === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  if (!hasSmtp) {
    process.stdout.write(`[EMAIL OTP — SMTP not configured] to=${to} otp=${otp}\n`);
    return;
  }
  await getTransporter().sendMail({
    from: env.SMTP_FROM ?? 'BUIDCO Portal <no-reply@buidco.in>',
    to,
    subject: 'Your BUIDCO Portal password reset code',
    text: `Your password reset code is ${otp}. It expires in 5 minutes. If you did not request this, you can ignore this email.`,
  });
}

/** SMS gateway not yet chosen — logs the OTP server-side instead of texting it. */
export function sendOtpSms(mobile: string, otp: string): void {
  process.stdout.write(`[SMS STUB — no gateway configured] to=${mobile} otp=${otp}\n`);
}

/**
 * Delivers the OTP to an eligible approver instead of the requester — the
 * approver relays the code to the requester (out of band) after verifying
 * their identity. The OTP itself is the approval; there is no separate
 * approve/reject action anywhere in the system.
 */
export async function sendApprovalRequestEmail(
  to: string,
  requesterUsername: string,
  requesterRole: string,
  otp: string,
): Promise<void> {
  if (!hasSmtp) {
    process.stdout.write(
      `[APPROVAL EMAIL — SMTP not configured] to=${to} requester=${requesterUsername} (${requesterRole}) otp=${otp}\n`,
    );
    return;
  }
  await getTransporter().sendMail({
    from: env.SMTP_FROM ?? 'BUIDCO Portal <no-reply@buidco.in>',
    to,
    subject: 'BUIDCO Portal — password reset code for your approval',
    text: `${requesterUsername} (${requesterRole}) has requested a password reset. After verifying their identity, share this code with them: ${otp}. It expires in 5 minutes.`,
  });
}
