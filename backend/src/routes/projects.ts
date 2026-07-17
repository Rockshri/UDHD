import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { actorFromReq, sessionDivisionId } from '../lib/actor.js';
import * as kpi from '../lib/kpi.js';
import { createProjectSchema, updateProjectSchema } from '../lib/projectFields.js';
import {
  requireAuth,
  requireProjectCreate,
  requireProjectDelete,
  requireProjectUpdate,
} from '../middleware/auth.js';
import {
  assertPdCanAccessProject,
  createProject,
  deleteProject,
  getProject,
  listProjects,
  listProjectsQuery,
  updateProject,
} from '../services/projectsService.js';
import { cosEotRouter } from './cosEot.js';
import { geoPhotosRouter } from './geoPhotos.js';
import { managementActionsRouter } from './managementActions.js';
import { milestonesRouter } from './milestones.js';

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

const projectIdParam = z.object({ projectId: z.string().uuid() });

/**
 * Phase C2 — for PDs, verify the :projectId in the URL belongs to their
 * session's division before letting the request touch the row or any of
 * its child resources (CoS/EoT, management actions, milestones, geo photos,
 * physical/milestone history). Returns 404 (not 403) to avoid leaking
 * existence of projects in other divisions.
 */
const pdProjectGuard: RequestHandler = async (req, _res, next) => {
  try {
    const pdDiv = sessionDivisionId(req);
    if (pdDiv !== null) {
      const { projectId } = projectIdParam.parse(req.params);
      await assertPdCanAccessProject(projectId, pdDiv);
    }
    next();
  } catch (err) {
    next(err);
  }
};

/* ---------- reads ---------- */

projectsRouter.get('/', async (req, res, next) => {
  try {
    const q = listProjectsQuery.parse(req.query);
    res.json(await listProjects(q, sessionDivisionId(req)));
  } catch (err) {
    next(err);
  }
});

// PD access guard for every /:projectId/* route (detail + sub-resources).
projectsRouter.use('/:projectId', pdProjectGuard);

projectsRouter.get('/:projectId', async (req, res, next) => {
  try {
    const { projectId } = projectIdParam.parse(req.params);
    res.json(await getProject(projectId, sessionDivisionId(req)));
  } catch (err) {
    next(err);
  }
});

projectsRouter.get('/:projectId/physical-history', async (req, res, next) => {
  try {
    const { projectId } = projectIdParam.parse(req.params);
    res.json({ items: await kpi.getProjectPhysicalHistory(projectId) });
  } catch (err) {
    next(err);
  }
});

projectsRouter.get('/:projectId/milestone-history', async (req, res, next) => {
  try {
    const { projectId } = projectIdParam.parse(req.params);
    res.json({ items: await kpi.getProjectMilestoneHistory(projectId) });
  } catch (err) {
    next(err);
  }
});

/* ---------- writes ---------- */

projectsRouter.post('/', requireProjectCreate, async (req, res, next) => {
  try {
    const body = createProjectSchema.parse(req.body);
    const out = await createProject(body, actorFromReq(req), sessionDivisionId(req));
    res.status(201).json(out);
  } catch (err) {
    next(err);
  }
});

projectsRouter.patch('/:projectId', requireProjectUpdate, async (req, res, next) => {
  try {
    const { projectId } = projectIdParam.parse(req.params);
    const body = updateProjectSchema.parse(req.body);
    const out = await updateProject(projectId, body, actorFromReq(req), sessionDivisionId(req));
    res.json(out);
  } catch (err) {
    next(err);
  }
});

projectsRouter.delete('/:projectId', requireProjectDelete, async (req, res, next) => {
  try {
    const { projectId } = projectIdParam.parse(req.params);
    await deleteProject(projectId, actorFromReq(req));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/* ---------- nested resources ---------- */

projectsRouter.use('/:projectId/cos-eot', cosEotRouter);
projectsRouter.use('/:projectId/management-actions', managementActionsRouter);
projectsRouter.use('/:projectId/milestones', milestonesRouter);
projectsRouter.use('/:projectId/geo-photos', geoPhotosRouter);
