# Testing Implementation Report — BUIDCO Dashboard

**Report date:** 2026-07-20
**Companion to:** [`TESTING.md`](./TESTING.md) (audit + gap analysis).
**What this doc covers:** everything installed, written, and verified in this session to fill the gaps identified in `TESTING.md`.

---

## 1. Executive summary

| Category | Before | After | Delta |
|---|---|---|---|
| Backend vitest suites | 2 files / 10 tests | 6 files / **42 tests** | **+4 files, +32 tests** |
| Frontend vitest suites | 11 files / 60 tests | 11 files / 60 tests | (unchanged — audit-only per scope) |
| Playwright E2E | ❌ none | **1 file / 5 tests** | New capability |
| Autocannon perf scripts | ❌ none | **2 scripts** (health, login) | New capability |
| Test-time DB dependency | none | none | Everything runs without Neon/Postgres |

**All new suites verified locally with exit code 0.**

---

## 2. Libraries installed

### Backend (`buidco-dashboard/backend`)

| Package | Version | Purpose | Notes |
|---|---|---|---|
| [`autocannon`](https://github.com/mcollina/autocannon) | `^8.0.0` | HTTP load / perf smoke test | `devDependency`. Added 2 mod-severity transitive audits (audit total now 16 vs 14). |
| `supertest` | `^7.0.0` | HTTP integration testing of Express app | Already present in `devDependencies` — this session started using it. |

### Frontend (`buidco-dashboard/frontend`)

| Package | Version | Purpose |
|---|---|---|
| [`@playwright/test`](https://playwright.dev/) | `^1.61.1` | End-to-end browser testing |
| Playwright Chromium browser | 149.0.7827.55 | ~114 MB. Downloaded via `npx playwright install chromium`. Firefox/WebKit intentionally skipped. |

**Not installed** (per your scope decisions): Cypress, k6, Stryker, Chromatic, axe-core, snyk, testcontainers.

---

## 3. New tests — by category

### 3.1 API / integration tests (backend)

Strategy: **mocked DB**. `vi.mock('../services/authService.js')` and `vi.mock('../lib/rateLimit.ts')` swap out the layers that hit Postgres/Redis, so tests validate the *HTTP layer* — routing, `zod` validation, cookie flags, `Content-Type` enforcement, `Authorization` header parsing, RBAC gates, error mapping — without a real database.

#### File: [`backend/src/routes/health.test.ts`](./backend/src/routes/health.test.ts) — 3 tests

| Test | What it proves |
|---|---|
| Returns 200 with `{status:'ok', timestamp}` | Express app boots under vitest env stubs; router mounts correctly. |
| Sets standard hardening headers | `helmet()` applied: `x-powered-by` gone, `x-content-type-options: nosniff`, `x-dns-prefetch-control` present. |
| `/api/does-not-exist` → 404 `NOT_FOUND` | `notFoundHandler` catches unmatched routes with the standard error envelope. |

#### File: [`backend/src/routes/auth.test.ts`](./backend/src/routes/auth.test.ts) — 10 tests

| Endpoint | Test | Assertion |
|---|---|---|
| `POST /auth/login` | Missing `username` | 400 `VALIDATION_ERROR`; service never called. |
| `POST /auth/login` | Empty `password` | 400 `VALIDATION_ERROR`. |
| `POST /auth/login` | Wrong password | 401 `INVALID_CREDENTIALS`. |
| `POST /auth/login` | Valid credentials | 200; body has `user`, `accessToken`, ISO `accessTokenExpiresAt`; `Set-Cookie: buidco_refresh=…; HttpOnly; SameSite=Lax; Path=/api/auth`. |
| `POST /auth/login` | PD step 1 | 200 with `{needsDivision:true, divisions:[…]}`; **no** cookie set yet. |
| `POST /auth/refresh` | `Content-Type: text/plain` | 415 `UNSUPPORTED_MEDIA_TYPE` (CSRF-lite check). Service never called. |
| `POST /auth/refresh` | Missing `buidco_refresh` cookie | 401 `NO_REFRESH_COOKIE`. |
| `POST /auth/refresh` | Service throws `INVALID_REFRESH` | 401 `INVALID_REFRESH`. |
| `POST /auth/refresh` | Service returns fresh tokens | 200 with rotated `buidco_refresh` cookie. |
| `POST /auth/logout` | Any request | 204; cookie cleared via `Set-Cookie` header. |

#### File: [`backend/src/middleware/auth.test.ts`](./backend/src/middleware/auth.test.ts) — 14 tests

Real JWT signing (via `signAccessToken` against the test secrets), mocked `getUserById`.

| Middleware | Scenario | Expected |
|---|---|---|
| `requireAuth` | Missing `Authorization` header | 401 `UNAUTHENTICATED` ("Missing bearer token"). |
| `requireAuth` | Malformed JWT | 401 `UNAUTHENTICATED` ("Invalid or expired"). |
| `requireAuth` | Valid token but user deactivated | 401 `UNAUTHENTICATED`. |
| `requireAuth` | Valid token + active user | 200; `req.user` populated. |
| `requireAuth` | PD token missing `divisionId` claim | 401 `UNAUTHENTICATED` ("PD session…"). |
| `requireWriter` | Viewer role | 403 `FORBIDDEN`. |
| `requireWriter` | Admin role | 200. |
| `requireMd` | Admin role | 403 `FORBIDDEN`. |
| `requireMd` | MD role | 200. |
| `requireRole()` (no args) | — | Throws at construction. |
| `requireProjectCreate` | MD with `canCreateProjects=false` | 200 (MD bypass). |
| `requireProjectCreate` | Viewer with `canCreateProjects=true` | 200. |
| `requireProjectCreate` | Viewer with `canCreateProjects=false` | 403 `FORBIDDEN_CREATE`. |
| `requireProjectDelete` | Viewer with `canDeleteProjects=false` | 403 `FORBIDDEN_DELETE`. |

#### File: [`backend/src/middleware/errorHandler.test.ts`](./backend/src/middleware/errorHandler.test.ts) — 5 tests

| Input | Expected output |
|---|---|
| `ZodError` from `.safeParse` | 400 `VALIDATION_ERROR` with `details.fieldErrors`. |
| `HttpError(418, 'IM_A_TEAPOT', 'Short and stout', {hint})` | 418; body preserves code, message, details. |
| `Error('Origin … is not allowed by CORS')` | 403 `CORS_FORBIDDEN`. |
| Unclassified `Error('boom')` | 500 `INTERNAL_ERROR`. |
| Any unknown path via `notFoundHandler` | 404 `NOT_FOUND`. |

**Backend suite total after this session: 6 files, 42 tests, exit 0, ~11 s.**

---

### 3.2 E2E tests (frontend)

Strategy: **mocked API responses via `page.route()`**. No backend / DB required — Playwright intercepts `/api/*` and fulfils each call locally.

#### File: [`frontend/e2e/login.spec.ts`](./frontend/e2e/login.spec.ts) — 5 tests

| Scenario | What it proves |
|---|---|
| Login page renders | Route `/login` mounts; heading, username input, password input, submit button all visible. |
| Wrong credentials (mocked 401) | Alert region shows *"Invalid username or password"*; URL stays on `/login`. |
| Rate limited (mocked 429) | Alert region shows *"Too many attempts. Try again in a few minutes."* |
| Successful MD login (mocked 200 + `Set-Cookie` + `/me` mock) | URL redirects away from `/login` — `Navigate` fires because `selectIsAuthenticated` flips. |
| PD two-step handshake | Step 1 submit triggers `needsDivision:true`; UI switches to the division picker with *"Signed in as pd_kumar"*, Division combobox, Continue + Back buttons. |

#### Config: [`frontend/playwright.config.ts`](./frontend/playwright.config.ts)

- Boots Vite dev server automatically (`webServer` block).
- `baseURL: http://localhost:5173`.
- Chromium project only.
- `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'` — debug artefacts on regressions.
- `reuseExistingServer: !CI` — locally uses whatever Vite is already running; in CI spins its own.

**E2E suite total: 1 file, 5 tests, exit 0, ~46 s** (dominated by Vite dev-server startup on cold run).

---

### 3.3 Performance test scripts (backend)

Two `autocannon`-based scripts under [`backend/perf/`](./backend/perf/):

#### [`backend/perf/health-load.js`](./backend/perf/health-load.js)

- 10 s @ 10 concurrent connections against `GET /api/health`.
- Measures Express + helmet + cors pipeline overhead — no DB / auth in the path.
- Run: `cd backend; npm run perf:health` (requires `npm run dev` in another terminal).
- Reads `TARGET_URL` env var; defaults to `http://localhost:4000`.
- Exit 1 if any errors observed.

#### [`backend/perf/login-load.js`](./backend/perf/login-load.js)

- 5 s @ 5 concurrent connections against `POST /api/auth/login`.
- Requires real DB + seeded test user (`TEST_USERNAME` / `TEST_PASSWORD` env, default `shri` / `ChangeMe123!`).
- ⚠️ **Rate limiter will trip** after 5 attempts / 15 min per IP. To measure the raw pipe (express + zod + bcrypt.compare + DB SELECT), unset `UPSTASH_REDIS_REST_URL` before starting the dev server — the rate limiter degrades to a no-op.
- Reports RPS, p99 latency, transport errors, non-2xx count.

**Neither script was executed** in this session — they need a running local backend and, for `login-load`, a seeded DB. Instructions inline in each file.

**Do NOT run either script against Render / Neon prod.** The free tiers will throttle or crash under sustained load, and login writes to `refresh_token` — you would pollute the production DB.

---

## 4. Design choices and why

| Decision | Rationale |
|---|---|
| Mock the DB (not use testcontainers/real DB) | Fastest feedback loop, zero infra, no Docker requirement, no risk to prod. Trade-off: doesn't verify actual SQL — but the two `authService` tests I did not write can be added later against a Neon test branch when that DB exists. |
| Mock at the service layer (`vi.mock('../services/authService.js')`) for auth route tests | Lets us assert precisely on route wiring — validation errors, HTTP status mapping, cookie flags — without recreating every drizzle-orm behaviour. |
| Sign real JWTs in `middleware/auth.test.ts` (only `getUserById` mocked) | The middleware's job is to *verify* JWTs, so replacing them with dummies would defeat the test. Real signing uses the test-config's 48-char secrets. |
| Playwright with mocked `/api/*` via `page.route()` | Zero backend dependency. Same test file can later be extended into a "real backend" suite by dropping the routes when a seeded local DB is available. |
| `page.route(REFRESH_URL_RE, 401)` in `beforeEach` | The app fires `/auth/refresh` on mount (App.tsx). Without this stub, the boot request hangs and the login page never fully renders. |
| Chromium-only | Cross-browser matters little for an internal dashboard shipped as static Vite assets — the target audience is Chrome/Edge on desktop. Saves ~500 MB of browser downloads. |
| autocannon over k6 | npm-installable, no extra binary, deterministic Node runtime. Sufficient for the load levels this app will see (single-tenant, dozens of concurrent users at peak). |

---

## 5. Reproducing everything

```powershell
# ── Backend integration + unit ─────────────────────────────
cd buidco-dashboard\backend
npm install                     # picks up autocannon
npm test                        # 42 tests, ~11 s

# ── Frontend unit + component ──────────────────────────────
cd ..\frontend
npm install                     # picks up @playwright/test
npm test                        # 60 tests, ~21 s

# ── Frontend E2E ───────────────────────────────────────────
npx playwright install chromium # one-time, ~114 MB
npm run test:e2e                # 5 tests, ~46 s (auto-boots Vite)

# ── Backend perf smoke (requires local dev server) ─────────
# Terminal A:
cd buidco-dashboard\backend
npm run dev
# Terminal B:
cd buidco-dashboard\backend
npm run perf:health             # ~10 s
# For perf:login, first seed a local admin: `npm run db:seed-admin`
```

---

## 6. What's still not covered

Consistent with `TESTING.md`, these were **out of scope** for this session and remain untested:

1. **Real-DB API integration tests** for `projects`, `mom`, `kpis`, `users`, `audit`, `preMonsoon`, etc. — these need a Neon test branch you provide, or a testcontainers Postgres.
2. **RTK Query slice tests** for the 11 other API slices (`projectsApi`, `kpisApi`, `momApi`, etc.). Only `baseQuery` + `authApi` behaviour is tested today.
3. **Large-component / page tests** — `MdSchemeSummaryModal`, `PortfolioKpiBody`, the input-sheet form group, the KPI charts.
4. **Post-login E2E flows** — project CRUD, MoM logging, dashboard filters, MD briefing popup dismissal. Would need either mocked KPI/project APIs (lots of stubs) or a seeded DB.
5. **Actual load-test results** from `perf/*.js` — scripts written but not executed (no local dev server running).
6. **Visual regression, mutation, accessibility** — libraries not installed per your original scope.

---

## 7. File inventory (new / modified this session)

| Path | Kind | Notes |
|---|---|---|
| `backend/src/routes/health.test.ts` | **new** | 3 tests |
| `backend/src/routes/auth.test.ts` | **new** | 10 tests |
| `backend/src/middleware/auth.test.ts` | **new** | 14 tests |
| `backend/src/middleware/errorHandler.test.ts` | **new** | 5 tests |
| `backend/perf/health-load.js` | **new** | autocannon script |
| `backend/perf/login-load.js` | **new** | autocannon script |
| `backend/package.json` | modified | added `autocannon` devDep; added `perf:health` + `perf:login` scripts |
| `frontend/playwright.config.ts` | **new** | Playwright config, Chromium project, auto-boots Vite |
| `frontend/e2e/login.spec.ts` | **new** | 5 E2E tests |
| `frontend/vite.config.ts` | modified | excluded `e2e/**` from vitest include glob |
| `frontend/package.json` | modified | added `@playwright/test` devDep; added `test:e2e` + `test:e2e:ui` scripts |
| `buidco-dashboard/TESTING_DETAILS.md` | **new** | this document |

**Nothing was committed to git.** Review the diff before you push:

```powershell
cd buidco-dashboard
git status
git diff
```

---

## 8. Library reference

Full stack in use after this session:

| Category | Library | Version | Where |
|---|---|---|---|
| Test runner | vitest | 2.0.2 | backend + frontend |
| HTTP integration | supertest | 7.0.0 | backend |
| Mocking | vitest.mock / vi.mocked | bundled | backend |
| JWT signing (in tests) | jsonwebtoken (via lib/tokens) | 9.0.2 | backend middleware tests |
| Zod schemas | zod | 3.23.8 | backend routes + tests |
| DOM env | jsdom | 24.1.0 | frontend |
| Component testing | @testing-library/react + jest-dom + user-event | 16 / 6.4.6 / 14.5.2 | frontend |
| E2E | @playwright/test + Chromium | 1.61.1 / Chromium 149 | frontend |
| Perf load | autocannon | 8.0.0 | backend |
| Static analysis | tsc | 5.5.3 | both |
| Linting | eslint + @typescript-eslint | 8.57.0 / 7.16.0 | both |
