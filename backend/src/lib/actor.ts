import type { Request } from 'express';
import type { AuditActor } from './audit.js';
import { HttpError } from '../middleware/errorHandler.js';

/** Extract the AuditActor from an authenticated request. Throws 401 if requireAuth was not applied. */
export function actorFromReq(req: Request): AuditActor {
  if (!req.user) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication required');
  }
  return {
    userId: req.user.userId,
    username: req.user.username,
    role: req.user.role,
  };
}

/**
 * PD's session division from the JWT-derived req.user. Returns null for
 * non-PD roles. Phase C2 endpoint filtering will call this on every
 * project-scoped query.
 */
export function sessionDivisionId(req: Request): number | null {
  if (!req.user) return null;
  if (req.user.role !== 'PD') return null;
  return req.user.divisionId ?? null;
}
