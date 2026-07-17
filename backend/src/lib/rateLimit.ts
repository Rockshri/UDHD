/**
 * Upstash-backed rate limiter with a graceful no-op fallback.
 *
 * If UPSTASH_REDIS_REST_URL / _TOKEN are unset, every check returns
 * `{ success: true }` and we log a single startup warning — so a
 * developer without Upstash locally can still run the server. Any
 * production deployment MUST have both env vars set (validated at
 * boot in env.ts).
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env, isProduction } from '../env.js';

const hasUpstash = Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);

if (!hasUpstash) {
  const msg = isProduction
    ? 'FATAL: UPSTASH_REDIS_REST_URL/TOKEN missing in production — rate limiting disabled.'
    : 'warn: UPSTASH_REDIS_REST_URL/TOKEN missing — rate limiting disabled (dev only).';
  process.stderr.write(`${msg}\n`);
}

const redis =
  hasUpstash && env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })
    : null;

function build(prefix: string, limiter: ReturnType<typeof Ratelimit.slidingWindow>): (key: string) => Promise<{ success: boolean; remaining: number; reset: number }> {
  if (!redis) {
    return async () => ({ success: true, remaining: Number.POSITIVE_INFINITY, reset: Date.now() });
  }
  const rl = new Ratelimit({ redis, limiter, prefix, analytics: false });
  return async (key: string) => {
    const { success, remaining, reset } = await rl.limit(key);
    return { success, remaining, reset };
  };
}

/**
 * 20 attempts per 15 minutes, per IP.
 *
 * Chosen with the PD two-step login in mind — each PD sign-in makes two
 * POSTs to /auth/login (credentials → then divisionId), so the old 5/15min
 * budget only allowed 2.5 PD sessions per window. 20/15min still blocks
 * credential brute-force (average ~1.3/min sustained) but doesn't lock out
 * a real MD/Admin/PD who typos their password once or logs in a few times
 * during the day. Increase further if legitimate lockouts happen in prod.
 */
export const loginLimiter = build('rl:auth:login', Ratelimit.slidingWindow(20, '15 m'));

/** 20 refresh calls per minute, per IP. */
export const refreshLimiter = build('rl:auth:refresh', Ratelimit.slidingWindow(20, '1 m'));

/** 20 uploads per minute, per user. Wired in Phase 4 when uploads land. */
export const uploadLimiter = build('rl:upload', Ratelimit.slidingWindow(20, '1 m'));
