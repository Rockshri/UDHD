import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './passwords.js';

describe('passwords', () => {
  it('hashes a password to a bcrypt string', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).toMatch(/^\$2[aby]?\$/);
    expect(hash.length).toBeGreaterThanOrEqual(60);
  });

  it('verifies a correct password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('wrong password', hash)).resolves.toBe(false);
  });

  it('rejects short passwords', async () => {
    await expect(hashPassword('short')).rejects.toThrow(/at least 8/);
  });
});
