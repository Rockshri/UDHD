import { Router } from 'express';
import { requireAuth, requireWriter } from '../middleware/auth.js';
import {
  createScheme, createSchemeSchema,
  createSector, createSectorSchema,
  getLookups,
} from '../services/lookupsService.js';

export const lookupsRouter = Router();

lookupsRouter.get('/', requireAuth, async (_req, res, next) => {
  try {
    res.json(await getLookups());
  } catch (err) {
    next(err);
  }
});

// ─── Create sector / scheme (MD or Admin) ──────────────────────────────
lookupsRouter.post('/sectors', requireWriter, async (req, res, next) => {
  try {
    const body = createSectorSchema.parse(req.body);
    const row = await createSector(body);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

lookupsRouter.post('/schemes', requireWriter, async (req, res, next) => {
  try {
    const body = createSchemeSchema.parse(req.body);
    const row = await createScheme(body);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});
