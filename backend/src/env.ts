import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const cwd = process.cwd();
const candidates = ['.env.local', '.env'];
for (const file of candidates) {
  const abs = resolve(cwd, file);
  if (existsSync(abs)) {
    loadDotenv({ path: abs, override: false });
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),

  CORS_ALLOWED_ORIGINS: z
    .string()
    .min(1, 'CORS_ALLOWED_ORIGINS is required (comma-separated list)')
    .transform((raw) =>
      raw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    )
    .pipe(z.array(z.string().url()).min(1, 'At least one allowed origin is required')),

  UPSTASH_REDIS_REST_URL: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional().or(z.literal('').transform(() => undefined)),

  UPLOADTHING_TOKEN: z.string().min(1).optional().or(z.literal('').transform(() => undefined)),

  COOKIE_DOMAIN: z.string().min(1).optional().or(z.literal('').transform(() => undefined)),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = parsed.error.flatten().fieldErrors;
  const lines = Object.entries(formatted).map(([k, msgs]) => `  - ${k}: ${(msgs ?? []).join('; ')}`);
  const message = `Invalid environment configuration:\n${lines.join('\n')}`;
  throw new Error(message);
}

export const env: Env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

