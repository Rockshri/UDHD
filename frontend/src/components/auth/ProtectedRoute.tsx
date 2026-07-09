import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../app/hooks';
import { selectAuthStatus } from '../../features/auth/authSlice';
import { Skeleton } from '../ui/skeleton';

/**
 * Gate on Redux auth status:
 *   - 'unknown'  → still trying the initial silent refresh; render a skeleton.
 *   - 'out'      → redirect to /login, remember where we were going.
 *   - 'in'       → render the child route.
 */
export function ProtectedRoute(): JSX.Element {
  const status = useAppSelector(selectAuthStatus);
  const location = useLocation();

  if (status === 'unknown') {
    return (
      <div className="min-h-screen bg-[#F4F6F9] px-6 py-10">
        <div className="mx-auto max-w-4xl space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (status === 'out') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
