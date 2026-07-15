import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useLoginMutation } from '../app/api/authApi';
import { useAppSelector } from '../app/hooks';
import { selectIsAuthenticated } from '../features/auth/authSlice';
import { Button } from '../components/ui/button';
import { BuidcoLogo } from '../components/layout/BuidcoLogo';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
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
    <div className="grid min-h-screen place-items-center bg-[#F4F6F9] px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center gap-3 pb-4 text-center">
          <BuidcoLogo size={44} />
          <div>
            <CardTitle className="text-base font-bold normal-case tracking-normal text-[#111827]">
              BUIDCO Project Monitoring
            </CardTitle>
            <p className="mt-1 text-[11px] uppercase tracking-wider text-[#6B7280]">
              Sign in to continue
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onSubmit}>
            {pdDivisions ? (
              // ── Step 2 — PD division picker ──
              <>
                <div className="rounded border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-[12px] text-[#1E3A5F]">
                  <p className="font-semibold">Signed in as {username}</p>
                  <p className="mt-0.5 text-[11.5px] text-[#374151]">
                    You're a Project Director. Choose which division you're
                    working in for this session.
                  </p>
                </div>
                <label className="grid gap-1 text-xs font-semibold text-[#374151]">
                  Division
                  <select
                    required
                    value={selectedDivisionId ?? ''}
                    onChange={(e) => setSelectedDivisionId(Number(e.target.value))}
                    className="h-9 w-full rounded border border-[#D1D5DB] bg-white px-2 text-sm text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-offset-1"
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
                    className="rounded border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-xs font-medium text-[#B91C1C]"
                    role="alert"
                  >
                    {errorMessage}
                  </p>
                ) : null}
                <div className="flex items-center gap-2">
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
                <label className="grid gap-1 text-xs font-semibold text-[#374151]">
                  Username
                  <Input
                    autoComplete="username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. shri"
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[#374151]">
                  Password
                  <Input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                {errorMessage ? (
                  <p
                    className="rounded border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-xs font-medium text-[#B91C1C]"
                    role="alert"
                  >
                    {errorMessage}
                  </p>
                ) : null}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Signing in…' : 'Sign in'}
                </Button>
              </>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function extractErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const anyErr = error as { status?: number; data?: { error?: { message?: string } } };
  if (anyErr.status === 401) return 'Invalid username or password.';
  if (anyErr.status === 429) return 'Too many attempts. Try again in a few minutes.';
  return anyErr.data?.error?.message ?? 'Sign-in failed. Please try again.';
}
