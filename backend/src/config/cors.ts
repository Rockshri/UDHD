import type { CorsOptions } from 'cors';
import { env } from '../env.js';

const allowlist = new Set(env.CORS_ALLOWED_ORIGINS);

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Same-origin / non-browser requests (curl, server-to-server) send no Origin header.
    // Behind the production reverse proxy the SPA and API share an origin, so browser
    // requests also arrive without an Origin — allow them.
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowlist.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With'],
  exposedHeaders: ['Content-Disposition'],
  maxAge: 600,
  optionsSuccessStatus: 204,
};
