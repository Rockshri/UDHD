import { Router } from 'express';
import { z } from 'zod';
import { actorFromReq } from '../lib/actor.js';
import { requireAuth, requireWriter } from '../middleware/auth.js';
import * as service from '../services/standaloneMgmtActionService.js';

/**
 * /api/management-actions/standalone
 *
 *   GET    /   — list all standalone (project-agnostic) actions
 *   POST   /   — create one; body = { topic, status?, deadlineDate? }
 *   PATCH  /:actionId — partial update (status flips, topic edits, etc.)
 *   DELETE /:actionId — delete
 *
 * Auth: reads require login (viewers can see the list); writes require
 * writer permission — same rule as per-project management_action_item.
 */
export const standaloneMgmtActionsRouter = Router();

const actionIdParam = z.object({ actionId: z.coerce.number().int().positive() });

standaloneMgmtActionsRouter.get('/', requireAuth, async (_req, res, next) => {
  try {
    res.json({ items: await service.listStandaloneActions() });
  } catch (err) {
    next(err);
  }
});

standaloneMgmtActionsRouter.post('/', requireWriter, async (req, res, next) => {
  try {
    const body = service.standaloneActionCreateSchema.parse(req.body);
    const actor = actorFromReq(req);
    const row = await service.createStandaloneAction(body, actor.userId);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

standaloneMgmtActionsRouter.patch('/:actionId', requireWriter, async (req, res, next) => {
  try {
    const { actionId } = actionIdParam.parse(req.params);
    const body = service.standaloneActionUpdateSchema.parse(req.body);
    const row = await service.updateStandaloneAction(actionId, body);
    res.json(row);
  } catch (err) {
    next(err);
  }
});

standaloneMgmtActionsRouter.delete('/:actionId', requireWriter, async (req, res, next) => {
  try {
    const { actionId } = actionIdParam.parse(req.params);
    await service.deleteStandaloneAction(actionId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
