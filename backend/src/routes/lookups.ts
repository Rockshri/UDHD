import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getLookups } from '../services/lookupsService.js';

export const lookupsRouter = Router();

lookupsRouter.get('/', requireAuth, async (_req, res, next) => {
  try {
    res.json(await getLookups());
  } catch (err) {
    next(err);
  }
});
