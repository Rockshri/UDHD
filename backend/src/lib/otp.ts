/**
 * Forgot-password OTP cryptography.
 *
 * OTP        — 6-digit numeric, bcrypt-hashed at rest (never stored raw).
 * Reset token — a second, short-lived random secret minted only after OTP
 *               verification succeeds. Stored the same way refresh_token
 *               stores its raw secret (lib/tokens.ts `signRefreshToken`):
 *               bcrypt hash on the row, raw value handed to the client.
 *               This lets /auth/reset-password trust "OTP was verified"
 *               without re-sending the OTP or inventing a stateless JWT
 *               "purpose" claim.
 */

import bcrypt from 'bcryptjs';
import { randomBytes, randomInt } from 'node:crypto';

const OTP_HASH_ROUNDS = 10;
const RESET_TOKEN_HASH_ROUNDS = 10;

export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, OTP_HASH_ROUNDS);
}

export function verifyOtp(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash);
}

export interface SignedResetToken {
  /** Handed to the client as `<otpId>.<rawSecret>`. */
  value: string;
  rawSecret: string;
  hash: string;
}

export async function signResetToken(otpId: number): Promise<SignedResetToken> {
  const rawSecret = randomBytes(32).toString('base64url');
  const hash = await bcrypt.hash(rawSecret, RESET_TOKEN_HASH_ROUNDS);
  return { value: `${otpId}.${rawSecret}`, rawSecret, hash };
}

export interface ParsedResetToken {
  otpId: number;
  rawSecret: string;
}

export function parseResetToken(token: string): ParsedResetToken {
  const lastDot = token.lastIndexOf('.');
  if (lastDot === -1) {
    throw new Error('Malformed reset token');
  }
  const otpId = Number(token.slice(0, lastDot));
  const rawSecret = token.slice(lastDot + 1);
  if (!Number.isInteger(otpId) || otpId <= 0 || !rawSecret) {
    throw new Error('Malformed reset token');
  }
  return { otpId, rawSecret };
}

export function verifyResetToken(rawSecret: string, storedHash: string): Promise<boolean> {
  return bcrypt.compare(rawSecret, storedHash);
}

/** `abc***@buidco.in` — first 3 chars of the local part kept, rest masked. */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const visible = local.slice(0, Math.min(3, local.length));
  return `${visible}${'*'.repeat(Math.max(local.length - visible.length, 3))}${domain}`;
}

/** `******7854` — last 4 digits kept, rest masked. */
export function maskMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length <= 4) return '*'.repeat(digits.length);
  const visible = digits.slice(-4);
  return `${'*'.repeat(digits.length - 4)}${visible}`;
}
