import { Router } from 'express';
import { z } from 'zod';
import { actorFromReq } from '../lib/actor.js';
import { requireAuth, requireWriter } from '../middleware/auth.js';
import * as service from '../services/usersService.js';

/**
 * User management endpoints.
 *
 * Access model (Phase 6.6):
 *   - MD: full CRUD, any role, any flag combination.
 *   - Admin: sees + edits Viewer users only (enforced inside the service).
 *   - Viewer: 403.
 *
 * Route-level guard is `requireWriter` (Admin+MD); role-specific scoping
 * (e.g. Admin can only touch Viewers) lives in the service so the audit
 * layer sees the correct actor context.
 */
export const usersRouter = Router();

usersRouter.use(requireAuth, requireWriter);

const idParam = z.object({ userId: z.coerce.number().int().positive() });

usersRouter.get('/', async (req, res, next) => {
  try {
    res.json({ items: await service.listUsers(actorFromReq(req)) });
  } catch (err) {
    next(err);
  }
});

usersRouter.post('/', async (req, res, next) => {
  try {
    const body = service.createUserSchema.parse(req.body);
    const out = await service.createUser(body, actorFromReq(req));
    res.status(201).json(out);
  } catch (err) {
    next(err);
  }
});

usersRouter.patch('/:userId', async (req, res, next) => {
  try {
    const { userId } = idParam.parse(req.params);
    const body = service.updateUserSchema.parse(req.body);
    const out = await service.updateUser(userId, body, actorFromReq(req));
    res.json(out);
  } catch (err) {
    next(err);
  }
});
