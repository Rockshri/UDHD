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
