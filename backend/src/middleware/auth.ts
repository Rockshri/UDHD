import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { userRoles, type UserRole } from '../db/enums.js';
import { verifyAccessToken } from '../lib/tokens.js';
import { getUserById } from '../services/authService.js';
import { HttpError } from './errorHandler.js';

function extractBearer(req: Request): string | null {
  const header = req.get('authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const token = extractBearer(req);
    if (!token) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Missing bearer token');
    }
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Invalid or expired access token');
    }

    const userId = Number(payload.sub);
    if (!Number.isInteger(userId)) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Malformed token subject');
    }
    // Access-token claims already say who the user is + their role, but a
    // second DB lookup catches deactivated accounts within one access-token
    // TTL. If p95 latency here becomes an issue we can cache in Redis.
    const user = await getUserById(userId);
    if (!user) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'User no longer exists or is inactive');
    }
    req.user = {
      userId: user.userId,
      role: user.role,
      username: user.username,
      fullName: user.fullName,
      canCreateProjects: user.canCreateProjects,
      canUpdateProjects: user.canUpdateProjects,
      canDeleteProjects: user.canDeleteProjects,
    };
    next();
  } catch (err) {
    next(err);
  }
};

export function requireRole(...roles: readonly UserRole[]): RequestHandler {
  if (roles.length === 0) {
    throw new Error('requireRole must be called with at least one role');
  }
  const allowed = new Set(roles);
  for (const role of roles) {
    if (!userRoles.includes(role)) {
      throw new Error(`Unknown role passed to requireRole: ${role}`);
    }
  }
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new HttpError(401, 'UNAUTHENTICATED', 'Authentication required'));
      return;
    }
    if (!allowed.has(req.user.role)) {
      next(
        new HttpError(
          403,
          'FORBIDDEN',
          `Role ${req.user.role} is not permitted for this action`,
        ),
      );
      return;
    }
    next();
  };
}

/**
 * Convenience: full CRUD on projects, CoS/EoT, management actions, MoM,
 * pre-monsoon, geo photos. Matches the RBAC matrix's Admin+MD writers.
 */
export const requireWriter = requireRole('Admin', 'MD');

/** MD-only: audit log reads and MD-scoped user management. */
export const requireMd = requireRole('MD');

/**
 * Fine-grained project-permission gates (Phase 6.6).
 *
 * MD role always passes (super-user bypass). Admin role always passes
 * (Admins retain full project CRUD as per prior behavior and are backfilled
 * TRUE in the migration). Viewer role is gated by the corresponding
 * `can_*_projects` flag loaded from the DB in `requireAuth`.
 *
 * The flags live on `req.user` — but our current `req.user` type doesn't
 * carry them. We look them up on demand from the DB inside the middleware
 * so the token payload stays minimal and un-cached-permission risks are
 * bounded to a single access-token TTL (10 min).
 */

type PermissionKey = 'canCreateProjects' | 'canUpdateProjects' | 'canDeleteProjects';

function makeProjectPermissionGate(
  key: PermissionKey,
  code: string,
  verb: string,
): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new HttpError(401, 'UNAUTHENTICATED', 'Authentication required'));
      return;
    }
    if (req.user.role === 'MD') {
      // MD always bypasses granular flags.
      next();
      return;
    }
    if (req.user[key]) {
      next();
      return;
    }
    next(
      new HttpError(
        403,
        code,
        `Your account does not have permission to ${verb} projects. Ask an MD or Admin to grant it.`,
      ),
    );
  };
}

export const requireProjectCreate = makeProjectPermissionGate(
  'canCreateProjects',
  'FORBIDDEN_CREATE',
  'create',
);
export const requireProjectUpdate = makeProjectPermissionGate(
  'canUpdateProjects',
  'FORBIDDEN_UPDATE',
  'update',
);
export const requireProjectDelete = makeProjectPermissionGate(
  'canDeleteProjects',
  'FORBIDDEN_DELETE',
  'delete',
);
