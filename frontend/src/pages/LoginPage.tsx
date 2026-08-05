import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useLoginMutation } from '../app/api/authApi';
import { useAppSelector } from '../app/hooks';
import { selectIsAuthenticated } from '../features/auth/authSlice';
import { Button } from '../components/ui/button';
import { BuidcoLogo } from '../components/layout/BuidcoLogo';
import { Input } from '../components/ui/input';

interface LocationState {
  from?: { pathname: string };
}

interface PdDivision {
  divisionId: number;
  divisionName: string;
}

export function LoginPage(): JSX.Element {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [login, { isLoading, error }] = useLoginMutation();
  const authed = useAppSelector(selectIsAuthenticated);
  const location = useLocation();

  // Step-2 state for PD login: after credentials verify, backend returns
  // { needsDivision, divisions[] }. We stash it here and render a picker.
  const [pdDivisions, setPdDivisions] = useState<PdDivision[] | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(null);

  const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? '/';
  if (authed) {
    return <Navigate to={redirectTo} replace />;
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    try {
      const body: { username: string; password: string; divisionId?: number } = {
        username,
        password,
      };
      if (pdDivisions && selectedDivisionId !== null) {
        body.divisionId = selectedDivisionId;
      }
      const res = await login(body).unwrap();
      // PD, step 1 → show division picker. Otherwise the mutation's
      // onQueryStarted already set credentials and the Navigate above fires.
      if ('needsDivision' in res && res.needsDivision) {
        setPdDivisions(res.divisions);
        setSelectedDivisionId(res.divisions[0]?.divisionId ?? null);
      }
    } catch {
      /* error state surfaces via `error`. Reset picker so user can retry cleanly. */
    }
  };

  const restartLogin = (): void => {
    setPdDivisions(null);
    setSelectedDivisionId(null);
    setPassword('');
  };

  const errorMessage = extractErrorMessage(error);

  return (
    <div className="min-h-screen w-full bg-[#F4F6F9] lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ── Left: brand panel (desktop) / compact top band (mobile) ── */}
      <aside
        className="relative overflow-hidden bg-gradient-to-br from-[#0F2440] via-[#1E3A5F] to-[#2C5282] px-6 py-8 text-white lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:px-12 lg:py-12"
      >
        {/* Decorative blobs — pointer-events-none so they never intercept clicks */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-20 h-72 w-72 rounded-full bg-white/5 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-[#3B82F6]/20 blur-3xl"
        />

        {/* Mobile: compact brand row (logo + name only). Desktop: full block. */}
        <div className="relative flex items-center gap-3 lg:block">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/95 p-2 shadow-lg ring-1 ring-white/40 lg:h-24 lg:w-24 lg:p-3">
            <BuidcoLogo size={80} />
          </div>
          <div className="lg:mt-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60 lg:text-[11px]">
              Government of Bihar
            </p>
            <h1 className="mt-0.5 text-lg font-extrabold leading-tight lg:mt-2 lg:text-3xl">
              BUIDCO
            </h1>
            <p className="text-[11px] font-medium leading-snug text-white/80 lg:mt-1 lg:text-sm">
              Bihar Urban Infrastructure Development Corporation
            </p>
          </div>
        </div>

        {/* Desktop-only mid section: tagline + feature bullets */}
        <div className="relative mt-10 hidden lg:block">
          <h2 className="max-w-md text-2xl font-bold leading-snug text-white">
            Project Monitoring System
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/75">
            A unified workspace for tracking every urban infrastructure
            project — from tender through completion — across Bihar's
            divisions.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-white/85">
            <FeatureBullet>Real-time project & tender workflow</FeatureBullet>
            <FeatureBullet>Division-scoped access for Project Directors</FeatureBullet>
            <FeatureBullet>Audit-trailed inputs & role-based controls</FeatureBullet>
          </ul>
        </div>

        {/* Desktop-only footer */}
        <p className="relative mt-8 hidden text-[11px] text-white/50 lg:block">
          © {new Date().getFullYear()} BUIDCO · Government of Bihar
        </p>
      </aside>

      {/* ── Right: sign-in form ── */}
      <section className="flex items-center justify-center px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-[0_4px_24px_rgba(15,36,64,0.08)] sm:p-8">
            <header className="mb-5">
              <h2 className="text-xl font-bold text-[#111827] sm:text-2xl">
                {pdDivisions ? 'Choose your division' : 'Welcome back'}
              </h2>
              <p className="mt-1 text-[13px] text-[#6B7280]">
                {pdDivisions
                  ? 'Pick the division you\'ll be working in for this session.'
                  : 'Sign in to continue to the monitoring dashboard.'}
              </p>
            </header>

            <form className="space-y-4" onSubmit={onSubmit}>
              {pdDivisions ? (
                // ── Step 2 — PD division picker ──
                <>
                  <div className="rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2.5 text-[12px] text-[#1E3A5F]">
                    <p className="font-semibold">Signed in as {username}</p>
                    <p className="mt-0.5 text-[11.5px] text-[#374151]">
                      You're a Project Director. Choose which division you're
                      working in for this session.
                    </p>
                  </div>
                  <label className="grid gap-1.5 text-xs font-semibold text-[#374151]">
                    Division
                    <select
                      required
                      value={selectedDivisionId ?? ''}
                      onChange={(e) => setSelectedDivisionId(Number(e.target.value))}
                      className="h-10 w-full rounded-md border border-[#D1D5DB] bg-white px-3 text-sm text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-offset-1"
                    >
                      {pdDivisions.map((d) => (
                        <option key={d.divisionId} value={d.divisionId}>
                          {d.divisionName}
                        </option>
                      ))}
                    </select>
                  </label>
                  {errorMessage ? (
                    <p
                      className="rounded-md border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-xs font-medium text-[#B91C1C]"
                      role="alert"
                    >
                      {errorMessage}
                    </p>
                  ) : null}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={isLoading || selectedDivisionId === null}
                    >
                      {isLoading ? 'Signing in…' : 'Continue'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={restartLogin}
                      disabled={isLoading}
                    >
                      ← Back
                    </Button>
                  </div>
                </>
              ) : (
                // ── Step 1 — credentials (all roles) ──
                <>
                  <label className="grid gap-1.5 text-xs font-semibold text-[#374151]">
                    Username
                    <Input
                      autoComplete="username"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. shri"
                      className="h-10"
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-semibold text-[#374151]">
                    Password
                    <Input
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-10"
                    />
                  </label>
                  {errorMessage ? (
                    <p
                      className="rounded-md border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-xs font-medium text-[#B91C1C]"
                      role="alert"
                    >
                      {errorMessage}
                    </p>
                  ) : null}
                  <Button
                    type="submit"
                    className="h-10 w-full text-sm font-semibold"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Signing in…' : 'Sign in'}
                  </Button>
                </>
              )}
            </form>
          </div>

          {/* Mobile-only footer (desktop shows it in the brand panel) */}
          <p className="mt-6 text-center text-[11px] text-[#6B7280] lg:hidden">
            © {new Date().getFullYear()} BUIDCO · Government of Bihar
          </p>
        </div>
      </section>
    </div>
  );
}

function FeatureBullet({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden
        className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#60A5FA]"
      />
      <span>{children}</span>
    </li>
  );
}

function extractErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const anyErr = error as { status?: number; data?: { error?: { message?: string } } };
  if (anyErr.status === 401) return 'Invalid username or password.';
  if (anyErr.status === 429) return 'Too many attempts. Try again in a few minutes.';
  return anyErr.data?.error?.message ?? 'Sign-in failed. Please try again.';
}
