import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireWriter } from '../middleware/auth.js';
import {
  createScheme, createSchemeSchema,
  createSector, createSectorSchema,
  deleteScheme, deleteSector,
  getLookups,
  updateScheme, updateSchemeSchema,
  updateSector, updateSectorSchema,
} from '../services/lookupsService.js';

export const lookupsRouter = Router();

lookupsRouter.get('/', requireAuth, async (_req, res, next) => {
  try {
    res.json(await getLookups());
  } catch (err) {
    next(err);
  }
});

const idParam = z.object({ id: z.coerce.number().int().positive() });

// ─── Sectors: create / rename / delete (MD or Admin) ───────────────────
lookupsRouter.post('/sectors', requireWriter, async (req, res, next) => {
  try {
    const body = createSectorSchema.parse(req.body);
    const row = await createSector(body);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

lookupsRouter.patch('/sectors/:id', requireWriter, async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    const body = updateSectorSchema.parse(req.body);
    const row = await updateSector(id, body);
    res.json(row);
  } catch (err) {
    next(err);
  }
});

lookupsRouter.delete('/sectors/:id', requireWriter, async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    await deleteSector(id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ─── Schemes: create / rename / delete (MD or Admin) ───────────────────
lookupsRouter.post('/schemes', requireWriter, async (req, res, next) => {
  try {
    const body = createSchemeSchema.parse(req.body);
    const row = await createScheme(body);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

lookupsRouter.patch('/schemes/:id', requireWriter, async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    const body = updateSchemeSchema.parse(req.body);
    const row = await updateScheme(id, body);
    res.json(row);
  } catch (err) {
    next(err);
  }
});

lookupsRouter.delete('/schemes/:id', requireWriter, async (req, res, next) => {
  try {
    const { id } = idParam.parse(req.params);
    await deleteScheme(id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
