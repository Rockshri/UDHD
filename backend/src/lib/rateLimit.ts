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

/** 5 attempts per 15 minutes, per IP. */
export const loginLimiter = build('rl:auth:login', Ratelimit.slidingWindow(5, '15 m'));

/** 20 refresh calls per minute, per IP. */
export const refreshLimiter = build('rl:auth:refresh', Ratelimit.slidingWindow(20, '1 m'));

/** 20 uploads per minute, per user. Wired in Phase 4 when uploads land. */
export const uploadLimiter = build('rl:upload', Ratelimit.slidingWindow(20, '1 m'));
