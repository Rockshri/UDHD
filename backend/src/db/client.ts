import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env, isProduction } from '../env.js';
import * as schema from './schema.js';
import * as views from './views.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: isProduction && env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  process.stderr.write(`Unexpected pg pool error: ${err.message}\n`);
});

export const db = drizzle(pool, { schema: { ...schema, ...views } });

export type Db = typeof db;
