import { describe, expect, it } from 'vitest';
import {
  generateOtp,
  hashOtp,
  maskEmail,
  maskMobile,
  parseResetToken,
  signResetToken,
  verifyOtp,
  verifyResetToken,
} from './otp.js';

describe('otp generation + hashing', () => {
  it('generates a 6-digit numeric code', () => {
    for (let i = 0; i < 20; i++) {
      const otp = generateOtp();
      expect(otp).toMatch(/^\d{6}$/);
    }
  });

  it('hashes an OTP to a bcrypt string and verifies it back', async () => {
    const otp = generateOtp();
    const hash = await hashOtp(otp);
    expect(hash).toMatch(/^\$2[aby]?\$/);
    await expect(verifyOtp(otp, hash)).resolves.toBe(true);
  });

  it('rejects an incorrect code', async () => {
    const hash = await hashOtp('123456');
    await expect(verifyOtp('654321', hash)).resolves.toBe(false);
  });
});

describe('reset tokens', () => {
  it('round-trips a token to the same otpId + a secret that matches the hash', async () => {
    const signed = await signResetToken(42);
    const parsed = parseResetToken(signed.value);
    expect(parsed.otpId).toBe(42);
    await expect(verifyResetToken(parsed.rawSecret, signed.hash)).resolves.toBe(true);
  });

  it('rejects a random secret against the stored hash', async () => {
    const signed = await signResetToken(42);
    await expect(verifyResetToken('not-the-real-secret', signed.hash)).resolves.toBe(false);
  });

  it('throws on a malformed token', () => {
    expect(() => parseResetToken('no-dot-here')).toThrow(/Malformed/);
    expect(() => parseResetToken('abc.secret')).toThrow(/Malformed/);
  });
});

describe('masking', () => {
  it('masks an email keeping the first 3 local-part chars', () => {
    expect(maskEmail('abcdef@buidco.in')).toBe('abc***@buidco.in');
  });

  it('masks a short local part down to 3 stars minimum', () => {
    expect(maskEmail('ab@buidco.in')).toBe('ab***@buidco.in');
  });

  it('masks a mobile number keeping the last 4 digits', () => {
    expect(maskMobile('9876547854')).toBe('******7854');
  });
});
