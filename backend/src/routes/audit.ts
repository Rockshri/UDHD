import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import * as service from '../services/auditService.js';

/** Audit trail viewer — MD and Admin only. */
export const auditRouter = Router();

auditRouter.use(requireAuth, requireRole('MD', 'Admin'));

auditRouter.get('/', async (req, res, next) => {
  try {
    const q = service.listAuditQuery.parse(req.query);
    res.json(await service.listAudit(q));
  } catch (err) {
    next(err);
  }
});
