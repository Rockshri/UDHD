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

export function LoginPage(): JSX.Element {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [login, { isLoading, error }] = useLoginMutation();
  const authed = useAppSelector(selectIsAuthenticated);
  const location = useLocation();

  const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? '/';
  if (authed) {
    return <Navigate to={redirectTo} replace />;
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    try {
      await login({ username, password }).unwrap();
    } catch {
      /* error state surfaces via `error`. */
    }
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
