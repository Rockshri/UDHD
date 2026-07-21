/**
 * Integration test for /api/health — the smoke test that Vercel's proxy
 * and any uptime monitor will hit. No mocks, no DB — proves the express
 * app boots cleanly under the vitest env stubs.
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

describe('GET /api/health', () => {
  const app = createApp();

  it('returns 200 with status ok and an ISO timestamp', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.timestamp).toBe('string');
    expect(() => new Date(res.body.timestamp as string).toISOString()).not.toThrow();
  });

  it('sets standard hardening headers (helmet)', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-dns-prefetch-control']).toBeDefined();
  });

  it('404s an unknown route with the notFoundHandler shape', async () => {
    const res = await request(app).get('/api/does-not-exist').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
