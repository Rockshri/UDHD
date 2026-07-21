# Testing Report — BUIDCO Dashboard

**Report date:** 2026-07-20
**Scope:** Audit of existing tests and coverage gaps across unit, API/integration, E2E, and security testing categories. No new test code was written — this is a status report and remediation plan.
**Target environment:** Local (no tests were run against Vercel / Render / Neon).

---

## 1. Executive summary

| Category | Status | Coverage |
|---|---|---|
| Unit tests — backend | ✅ Passing (10/10) | 2 modules covered (bcrypt password + JWT refresh-token round-trip). ~13 lib/service/middleware modules untested. |
| Unit tests — frontend | ✅ Passing (60/60) | 11 test files covering auth slice, permission selectors, hooks, formatters, and small badge/card components. Larger components + pages untested. |
| API / integration tests | ❌ None | Zero HTTP-level tests. Express routes, RBAC middleware, and services are all untested end-to-end. |
| E2E tests | ❌ None | No Playwright / Cypress config. No browser-flow coverage of login, MD briefing, project CRUD, etc. |
| Security — deps audit | ⚠️ **1 production-shipping vuln** (drizzle-orm SQL injection, high). Other high/critical vulns are dev-only. |
| Security — auth flow review | ✅ Solid design. Helmet, HS256 JWTs, bcrypt hashing, refresh-reuse detection, RBAC, rate limiting, zod validation, CSRF-lite. |

---

## 2. Existing tests — what runs today

### 2.1 Backend (`buidco-dashboard/backend`)

Run with:

```powershell
cd buidco-dashboard\backend
npm test
```

**Result: 2 files, 10 tests, all pass, ~4.4 s.**

| Test file | Tests | What it covers |
|---|---|---|
| `src/lib/passwords.test.ts` | 4 | `bcryptjs` hash + verify + reject-incorrect + edge cases. |
| `src/lib/tokens.test.ts` | 6 | Refresh-token JWT round-trip (`jti`, secret hash match), signing/verification with the HS256 secrets. |

**Test-time environment:** all sensitive env vars are stubbed inside `backend/vitest.config.ts` (`NODE_ENV=test`, dummy `DATABASE_URL`, 48-char JWT secrets, `CORS_ALLOWED_ORIGINS=http://localhost:5173`). No real DB or Redis is required.

**Library stack:**
- **Test runner:** [vitest](https://vitest.dev) 2.0.2
- **Assertion API:** Vitest's built-in `expect` (Chai-compatible)
- **Extra libs available** (declared but not used yet): `supertest@^7`, `@types/supertest`

### 2.2 Frontend (`buidco-dashboard/frontend`)

Run with:

```powershell
cd buidco-dashboard\frontend
npm test
```

**Result: 11 files, 60 tests, all pass, ~14.9 s.**

| Test file | Tests | What it covers |
|---|---|---|
| `src/app/baseQuery.test.ts` | 4 | RTK Query `baseQueryWithReauth` — refresh-on-401 handshake, credential-clear on refresh-fail, concurrent-401 de-duplication. |
| `src/features/auth/authSlice.test.ts` | 9 | Reducer transitions for `setCredentials`, `clearCredentials`, `markUnauthenticated`; selectors. |
| `src/features/auth/permissions.test.ts` | 5 | `selectCan*Projects` + `selectCanManageUsers` behavior across MD/Admin/Viewer/unauthenticated. |
| `src/hooks/useProjectDraft.test.ts` | 7 | Draft seeding, dirty tracking, reset, payload transform (trim, URL validation). |
| `src/hooks/useProjectFilters.test.tsx` | 5 | URL-driven filter state, hook lifecycle. |
| `src/lib/formatters.test.ts` | 14 | Currency-Cr formatter, dates, percentages, edge cases (null / undefined / NaN). |
| `src/components/projects/StatusBadge.test.tsx` | 4 | Rendering across status enum values. |
| `src/components/projects/PriorityBadge.test.tsx` | 3 | Rendering across priority enum values. |
| `src/components/mom/MoMStatusBadge.test.tsx` | 2 | MoM status rendering. |
| `src/components/overview/StatCard.test.tsx` | 6 | Label/value rendering, formatter application, click behavior. |
| `src/components/input-sheet/MilestonesSection.test.tsx` | 1 | Milestones section renders. |

**Library stack:**
- **Test runner:** [vitest](https://vitest.dev) 2.0.2
- **DOM environment:** [jsdom](https://github.com/jsdom/jsdom) 24.1.0
- **Component testing:** [@testing-library/react](https://testing-library.com/docs/react-testing-library/intro/) 16, [@testing-library/user-event](https://testing-library.com/docs/user-event/intro) 14.5.2, [@testing-library/jest-dom](https://github.com/testing-library/jest-dom) 6.4.6
- **Vite plugin:** `@vitejs/plugin-react` 4.3.1

**Non-blocking warnings observed during run:** React Router v7 future-flag warnings (`v7_startTransition`, `v7_relativeSplatPath`) fire from `useProjectFilters.test.tsx` and `StatCard.test.tsx`. These do not fail the suite — they signal upcoming React Router 7 behavior changes to plan for.

---

## 3. Security testing

### 3.1 Dependency vulnerabilities (`npm audit`)

Ran `npm audit` in both projects on 2026-07-20.

#### Backend — 14 vulnerabilities (8 moderate, 5 high, 1 critical)

| Package | Severity | CVSS | Advisory | Ships to prod? |
|---|---|---|---|---|
| **`drizzle-orm`** (< 0.45.2) | high | 7.5 | [GHSA-gpj5-g38j-94v9](https://github.com/advisories/GHSA-gpj5-g38j-94v9) — SQL injection via improperly escaped identifiers | **Yes** ← real risk |
| `effect` (< 3.20.0) | high | 7.4 | [GHSA-38f7-945m-qr2g](https://github.com/advisories/GHSA-38f7-945m-qr2g) — AsyncLocalStorage context contamination under concurrent RPC (via `uploadthing`) | Yes, if uploads used |
| `@uploadthing/shared` | high | — | Transitively via `effect` | Yes, if uploads used |
| `vitest` (< 3.2.6) | critical | 9.8 | [GHSA-5xrq-8626-4rwp](https://github.com/advisories/GHSA-5xrq-8626-4rwp) — Vitest UI server arbitrary file read/exec | No — devDependency |
| `vite` (< 6.4.2) | high | 7.5 | [GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff) — `server.fs.deny` bypass on Windows | No — devDependency |
| `esbuild` (< 0.24.3) | moderate | 5.3 | [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) — dev server CORS bypass | No — devDependency |
| `drizzle-kit`, `@esbuild-kit/*`, `@vitest/mocker`, `vite-node` | moderate | — | Transitive on the above | No — devDependency |
| `exceljs` / `uuid` | moderate | — | uuid < 11.1.1 buffer bounds check | Yes, in `gen:input-template` script |

**Priority:** upgrade **`drizzle-orm`** to ≥ 0.45.2 (semver-major; verify migrations still generate correctly). All other high/critical items are `devDependencies` and don't run in production, but should still be tracked.

#### Frontend — 5 vulnerabilities (3 moderate, 1 high, 1 critical)

| Package | Severity | Ships to prod? |
|---|---|---|
| `vitest` (< 3.2.6) | critical | No — devDependency |
| `vite` (< 6.4.2) | high | No — devDependency |
| `esbuild`, `@vitest/mocker`, `vite-node` | moderate | No — devDependency |

**All frontend vulns are dev-only.** The frontend builds to static assets on Vercel; runtime doesn't include Vite/Vitest.

**Suggested remediation command** (verify semver-major impact first):

```powershell
cd buidco-dashboard\backend; npm audit fix --force   # inspect diff before committing
cd buidco-dashboard\frontend; npm audit fix --force
```

### 3.2 Auth / API surface — code review

The auth and security posture in the codebase is unusually thorough for a project this size. Reviewed:

| Layer | File | Finding |
|---|---|---|
| HTTP hardening | `backend/src/app.ts` | `helmet()` on, `x-powered-by` disabled, `trust proxy: 1`, JSON body limit 1 MB. ✅ |
| CORS | `backend/src/config/cors.ts` | Strict allowlist from `CORS_ALLOWED_ORIGINS` env var. `credentials: true`, explicit `methods` + `allowedHeaders`. ⚠️ Allowlist requires exact match — Vercel preview URLs must be added manually. Rejection surfaces as `CORS_FORBIDDEN` (403). |
| Cookies | `backend/src/lib/cookies.ts` | Refresh cookie: `httpOnly`, `secure` in prod, `sameSite: 'lax'`, path scoped to `/api/auth`. ✅ (SameSite=lax works because the SPA proxies `/api/*` through Vercel to Render, so browser sees same-origin.) |
| JWT | `backend/src/lib/tokens.ts` | HS256; secrets validated ≥ 32 chars by zod at boot. Access-token TTL 900 s, refresh 30 d. Refresh = `<jwt>.<32-byte-random-secret>` — the secret's bcrypt hash is stored on the DB row, so a leaked JWT-signing secret alone can't refresh. ✅ Best-practice. |
| Refresh-reuse detection | `backend/src/services/authService.ts` | Presenting a revoked refresh token triggers a cascade revoke of every active session for that user (defense against session hijack). ✅ |
| Password storage | `backend/src/lib/passwords.ts` | `bcryptjs`, tested. ✅ |
| Rate limiting | `backend/src/lib/rateLimit.ts` | Upstash Redis-backed sliding window. Login: 5/15 min per IP. Refresh: 20/min per IP. Graceful no-op fallback in dev (with a stderr warning). ⚠️ Production **must** have Upstash env vars — otherwise rate limiting silently disables and only a stderr line is emitted. |
| RBAC | `backend/src/middleware/auth.ts` | `requireAuth` (Bearer JWT + DB re-check for deactivated accounts), `requireRole`, granular `requireProject{Create,Update,Delete,View}` gates. MD bypasses granular flags. ✅ |
| CSRF | `backend/src/routes/auth.ts` (refresh route) | `requireJsonContentType` middleware on `/auth/refresh` — rejects non-JSON POSTs (defense against form-submit CSRF). Combined with SameSite=lax cookies. ✅ Reasonable posture. |
| Payload validation | Every route | `zod` schemas parsed at the top of each handler. Errors caught in `errorHandler` and returned as 400 `VALIDATION_ERROR`. ✅ |
| Error hiding | `backend/src/middleware/errorHandler.ts` | Production hides raw error messages behind generic `INTERNAL_ERROR`. ⚠️ No structured error logging is visible — server-side you can only see errors in Render's stdout/stderr. Consider a proper logger (pino) with sinks. |

**No pentest was performed.** These are code-level observations only.

---

## 4. Gaps — untested categories

### 4.1 API / integration testing (backend HTTP layer) — **not implemented**

`supertest` and `@types/supertest` are already declared as `devDependencies` in `backend/package.json` — the harness is one file away from existing but has never been wired up.

**Uncovered surface (15 routes):** `auth`, `audit`, `cosEot`, `geoPhotos`, `health`, `kpis`, `lookups`, `managementActions`, `milestones`, `mom`, `momActionPoints`, `preMonsoon`, `projects`, `uploads`, `users`.

**Uncovered service layer (11 services):** `auditService`, `authService.login/refresh/logout/getUserById`, `cosEotService`, `geoPhotosService`, `lookupsService`, `managementActionService`, `milestonesService`, `momService`, `preMonsoonService`, `projectsService`, `usersService`.

**Uncovered middleware:** `requireAuth`, `requireRole`, all four `requireProject*` gates, `errorHandler`, `notFoundHandler`.

**Recommended minimum coverage (would add ~1 day of work):**
1. **Auth handshake:** `POST /auth/login` with valid creds, invalid creds, PD needsDivision two-step, PD wrong division, rate-limit trigger.
2. **Refresh flow:** `POST /auth/refresh` with fresh cookie, missing cookie, revoked cookie (reuse detection cascade), expired cookie, non-JSON body (CSRF-lite check).
3. **RBAC:** `GET /audit` and `PATCH /users/:id` reject Viewer, permit MD/Admin.
4. **Project CRUD:** create/update/delete happy paths + permission failure paths.
5. **Rate limiter:** ensure the 6th login within 15 min returns 429 + `Retry-After`.

**Suggested libraries:** `supertest` (already present), `@testcontainers/postgresql` or a Neon test branch for a real DB, `nock` if any outbound HTTP mocking is needed.

### 4.2 E2E testing — **not implemented**

No `playwright.config.ts` or `cypress.config.ts`. No `e2e/`, `tests/e2e/`, or `playwright/` folder. No `@playwright/test` or `cypress` in either `package.json`.

**Recommended minimum flows:**
1. Login → dashboard renders → logout → refresh page → back to login.
2. MD login → MD Scheme Summary Briefing popup opens on first login → dismiss.
3. Create a project → appears in list → edit → delete.
4. PD two-step login: creds → division picker → dashboard scoped to division.
5. 401 during a session → silent refresh works transparently (no redirect).

**Suggested libraries:**
- [@playwright/test](https://playwright.dev/) (recommended over Cypress: better multi-browser support, faster, simpler CI story).
- Optionally [axe-core](https://github.com/dequelabs/axe-core) + `@axe-core/playwright` for accessibility assertions on the same flows.

### 4.3 Performance testing — **not implemented, not requested**

Not in the requested scope for this report. If added later, [k6](https://k6.io/) run from a local script hitting a local backend + seeded DB is the safest path. Do **not** load-test the deployed Render free tier — you will either exhaust its quota or trigger IP-level throttling.

### 4.4 Visual regression, mutation, and accessibility testing — **not implemented, not requested**

Would recommend at a later stage:
- **Visual regression:** [Playwright screenshots](https://playwright.dev/docs/test-snapshots) or [Chromatic](https://www.chromatic.com/).
- **Mutation testing:** [Stryker](https://stryker-mutator.io/) to measure how meaningful the existing unit tests actually are.
- **Accessibility:** [axe-core](https://github.com/dequelabs/axe-core) integrated with vitest/Playwright.

---

## 5. Reproducing this report

```powershell
# Backend unit tests
cd buidco-dashboard\backend
npm install
npm test                    # 10 tests, ~4 s
npm audit                   # 14 vulns

# Frontend unit tests
cd ..\frontend
npm install
npm test                    # 60 tests, ~15 s
npm audit                   # 5 vulns

# Type-check what the Vercel build actually runs
npx tsc -b                  # exit 0 expected
```

---

## 6. Prioritized remediation checklist

1. **[High, prod]** Upgrade `drizzle-orm` to ≥ 0.45.2 (SQL injection fix). Verify Drizzle Kit migrations still generate identical SQL.
2. **[High, prod]** Confirm Upstash env vars (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) are set on Render — otherwise rate limiting is silently off in production.
3. **[Med, prod]** Add server-side structured logging (pino → Render logs) so future `INTERNAL_ERROR` incidents are diagnosable without a redeploy.
4. **[Med, CI]** Add API integration tests for the auth flow (login, refresh, RBAC). `supertest` is already in `devDependencies`.
5. **[Med, CI]** Add Playwright E2E covering login + one CRUD flow. Prevents future deploys from breaking the golden path.
6. **[Low, CI]** Track dev-tool vulns (vitest/vite/esbuild) and upgrade at next convenient semver-major refresh.
7. **[Low, UX]** Address the two React Router v7 future-flag warnings before the eventual v7 upgrade.

---

## 7. Library reference (what's used, per category)

| Category | Library | Version | Where |
|---|---|---|---|
| Test runner | vitest | 2.0.2 | backend + frontend |
| Assertions | vitest `expect` (Chai-style) | bundled | backend + frontend |
| DOM env | jsdom | 24.1.0 | frontend |
| Component testing | @testing-library/react | 16.0.0 | frontend |
| DOM matchers | @testing-library/jest-dom | 6.4.6 | frontend |
| User simulation | @testing-library/user-event | 14.5.2 | frontend |
| HTTP integration (declared, unused) | supertest | 7.0.0 | backend |
| Static analysis | typescript compiler (`tsc -b`) | 5.5.3 | backend + frontend |
| Linting | eslint + @typescript-eslint | 8.57.0 / 7.16.0 | backend + frontend |
| Schema validation (runtime) | zod | 3.23.8 | backend + frontend |
| Dependency scanning | npm audit | bundled with npm | backend + frontend |

**Not currently installed:** Playwright, Cypress, k6, Artillery, Stryker, Chromatic, axe-core, snyk.
