import { useEffect } from 'react';
import { useRefreshMutation } from './app/api/authApi';
import { useAppSelector } from './app/hooks';
import { selectAuthStatus } from './features/auth/authSlice';
import { AppRoutes } from './router';

/**
 * On mount, silently refresh from the still-valid refresh cookie so a
 * page reload doesn't kick the user out until the refresh actually
 * fails. If refresh returns 401, ProtectedRoute redirects to /login.
 */
export function App(): JSX.Element {
  const status = useAppSelector(selectAuthStatus);
  const [refresh] = useRefreshMutation();

  useEffect(() => {
    if (status === 'unknown') {
      void refresh();
    }
  }, [status, refresh]);

  return <AppRoutes />;
}
