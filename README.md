# BUIDCO Project Monitoring Dashboard

Decoupled React SPA (Vite) + Express REST API for the Bihar Urban Infrastructure Development Corporation.

```
/buidco-dashboard
├── /frontend   Vite + React 18 + TypeScript + Tailwind + shadcn/ui
└── /backend    Express + TypeScript + Drizzle + PostgreSQL
```

The two apps are independently installable and deployable. In dev they run on separate ports; the Vite dev server proxies `/api/*` to Express so the browser only sees one origin locally. In production both are expected to sit behind a shared reverse proxy on one public domain.

## Prerequisites

- Node.js 20+
- PostgreSQL 15+ reachable from the machine running `/backend`
- Upstash Redis instance (for auth + upload rate limits)
- UploadThing account + app token (for geo-photo uploads)

## First-time setup

```bash
# backend
cd backend
cp .env.example .env.local     # then fill in real values
npm install

# frontend
cd ../frontend
cp .env.local.example .env.local
npm install
```

## Run in development

Two terminals:

```bash
# terminal 1
cd backend
npm run dev            # Express on http://localhost:4000

# terminal 2
cd frontend
npm run dev            # Vite on http://localhost:5173, /api proxied to :4000
```

Open http://localhost:5173.

## Environment variables

### Backend (`backend/.env.local` — all secret)

| Key | Purpose |
| --- | --- |
| `NODE_ENV` | `development` \| `test` \| `production` |
| `PORT` | Express port (default `4000`) |
| `DATABASE_URL` | Postgres connection string |
| `JWT_ACCESS_SECRET` | HS256 signing secret for access tokens (≥32 chars) |
| `JWT_REFRESH_SECRET` | HS256 signing secret for refresh tokens (≥32 chars) |
| `ACCESS_TOKEN_TTL_SECONDS` | Access-token lifetime (default `900` = 15 min) |
| `REFRESH_TOKEN_TTL_SECONDS` | Refresh-token lifetime (default `2592000` = 30 days) |
| `CORS_ALLOWED_ORIGINS` | Comma-separated origin allowlist (e.g. `http://localhost:5173,https://buidco.example.gov.in`) |
| `UPSTASH_REDIS_REST_URL` | Upstash REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash REST token |
| `UPLOADTHING_TOKEN` | UploadThing app token |
| `COOKIE_DOMAIN` | Optional cookie domain override for the refresh cookie |

### Frontend (`frontend/.env.local` — all ships to the browser)

Only `VITE_`-prefixed values. Never put a secret here.

| Key | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Base URL for API calls (default `/api` — resolved by the Vite proxy in dev, and by the shared reverse proxy in prod) |

## Delivery phases

1. Repo scaffolding + env validation + baseline `cors` / `helmet` **← current**
2. Drizzle schema + migrations (mirrors `BUIDCO_table.md`)
3. JWT auth + refresh-token rotation + RBAC middleware
4. Express routers / controllers / service layer on top of the schema's views
5. Redux Toolkit store + RTK Query endpoints
6. UI in Tailwind / shadcn matching the reference JSX + the new milestone Input Sheet
