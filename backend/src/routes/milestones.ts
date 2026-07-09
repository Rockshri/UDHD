import { Router } from 'express';
import { z } from 'zod';
import { actorFromReq } from '../lib/actor.js';
import { requireAuth, requireWriter } from '../middleware/auth.js';
import * as service from '../services/milestonesService.js';

/** Mounted at /api/projects/:projectId/milestones (mergeParams). */
export const milestonesRouter = Router({ mergeParams: true });

const projectParams = z.object({ projectId: z.string().uuid() });

milestonesRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const { projectId } = projectParams.parse(req.params);
    res.json({ items: await service.listMilestones(projectId) });
  } catch (err) {
    next(err);
  }
});

milestonesRouter.put('/', requireWriter, async (req, res, next) => {
  try {
    const { projectId } = projectParams.parse(req.params);
    const body = service.replaceMilestonesSchema.parse(req.body);
    const items = await service.replaceMilestones(projectId, body, actorFromReq(req));
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

milestonesRouter.post('/monthly-progress', requireWriter, async (req, res, next) => {
  try {
    const { projectId } = projectParams.parse(req.params);
    const body = service.upsertMonthlyProgressSchema.parse(req.body);
    const items = await service.upsertMonthlyProgress(projectId, body, actorFromReq(req));
    res.status(201).json({ items });
  } catch (err) {
    next(err);
  }
});
