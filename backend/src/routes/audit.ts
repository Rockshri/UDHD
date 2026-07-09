import { Router } from 'express';
import { requireAuth, requireMd } from '../middleware/auth.js';
import * as service from '../services/auditService.js';

/** MD-only audit trail viewer. */
export const auditRouter = Router();

auditRouter.use(requireAuth, requireMd);

auditRouter.get('/', async (req, res, next) => {
  try {
    const q = service.listAuditQuery.parse(req.query);
    res.json(await service.listAudit(q));
  } catch (err) {
    next(err);
  }
});
