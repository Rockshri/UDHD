import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../../app/hooks';
import { selectCurrentUser } from '../../features/auth/authSlice';
import type { UserRole } from '../../types/api';

interface RoleGateProps {
  allow: readonly UserRole[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Renders children only when the current user's role is in `allow`.
 * Used inline (e.g. hiding a MD-only button) — NOT the security
 * boundary; that lives in Express middleware. See ProtectedRoute for
 * route-level auth gating and RoleGuardedRoute for MD-only routes.
 */
export function RoleGate({ allow, fallback = null, children }: RoleGateProps): JSX.Element {
  const user = useAppSelector(selectCurrentUser);
  if (!user || !allow.includes(user.role)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}

/** For guarding a whole route. Renders <Navigate to='/'> when the role check fails. */
export function RoleGuardedRoute({
  allow,
  children,
}: {
  allow: readonly UserRole[];
  children: React.ReactNode;
}): JSX.Element {
  const user = useAppSelector(selectCurrentUser);
  if (!user || !allow.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
