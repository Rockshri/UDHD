import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import * as kpi from '../lib/kpi.js';

export const kpisRouter = Router();

kpisRouter.use(requireAuth);

kpisRouter.get('/overview', async (_req, res, next) => {
  try {
    res.json(await kpi.getOverviewKpis());
  } catch (err) {
    next(err);
  }
});

kpisRouter.get('/schedule-vs-actual', async (_req, res, next) => {
  try {
    res.json(await kpi.getScheduleVsActual());
  } catch (err) {
    next(err);
  }
});

kpisRouter.get('/stage-buckets', async (_req, res, next) => {
  try {
    res.json({ items: await kpi.getStageBuckets() });
  } catch (err) {
    next(err);
  }
});

kpisRouter.get('/work-type-counts', async (_req, res, next) => {
  try {
    res.json(await kpi.getWorkTypeCounts());
  } catch (err) {
    next(err);
  }
});

kpisRouter.get('/financial-securities', async (_req, res, next) => {
  try {
    res.json(await kpi.getFinancialSecurities());
  } catch (err) {
    next(err);
  }
});

kpisRouter.get('/pbg-expiry-alerts', async (_req, res, next) => {
  try {
    res.json({ items: await kpi.getPbgExpiryAlerts() });
  } catch (err) {
    next(err);
  }
});

kpisRouter.get('/om-status', async (_req, res, next) => {
  try {
    res.json({ items: await kpi.getOmStatus() });
  } catch (err) {
    next(err);
  }
});

kpisRouter.get('/om-expiry-alerts', async (_req, res, next) => {
  try {
    res.json({ items: await kpi.getOmExpiryAlerts() });
  } catch (err) {
    next(err);
  }
});

kpisRouter.get('/scheme-chart', async (_req, res, next) => {
  try {
    res.json({ items: await kpi.getSchemeChart() });
  } catch (err) {
    next(err);
  }
});

kpisRouter.get('/status-donut', async (_req, res, next) => {
  try {
    res.json({ items: await kpi.getStatusDonut() });
  } catch (err) {
    next(err);
  }
});

kpisRouter.get('/scheme-summary', async (_req, res, next) => {
  try {
    res.json({ items: await kpi.getSchemeSummary() });
  } catch (err) {
    next(err);
  }
});

kpisRouter.get('/scheme-kpi-summary', async (_req, res, next) => {
  try {
    res.json({ items: await kpi.getSchemeKpiSummary() });
  } catch (err) {
    next(err);
  }
});

kpisRouter.get('/sector-summary', async (_req, res, next) => {
  try {
    res.json({ items: await kpi.getSectorSummary() });
  } catch (err) {
    next(err);
  }
});

kpisRouter.get('/district-summary', async (_req, res, next) => {
  try {
    res.json({ items: await kpi.getDistrictSummary() });
  } catch (err) {
    next(err);
  }
});

kpisRouter.get('/division-summary', async (_req, res, next) => {
  try {
    res.json({ items: await kpi.getDivisionSummary() });
  } catch (err) {
    next(err);
  }
});

kpisRouter.get('/region-summary', async (_req, res, next) => {
  try {
    res.json({ items: await kpi.getRegionSummary() });
  } catch (err) {
    next(err);
  }
});

kpisRouter.get('/delay-status', async (_req, res, next) => {
  try {
    res.json({ items: await kpi.getDelayStatus() });
  } catch (err) {
    next(err);
  }
});

kpisRouter.get('/outstanding-gaps', async (_req, res, next) => {
  try {
    res.json({ items: await kpi.getOutstandingGaps() });
  } catch (err) {
    next(err);
  }
});

kpisRouter.get('/management-action-summary', async (_req, res, next) => {
  try {
    res.json({ items: await kpi.getManagementActionSummary() });
  } catch (err) {
    next(err);
  }
});

const cosEotQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

kpisRouter.get('/cos-eot-records', async (req, res, next) => {
  try {
    const { limit, offset } = cosEotQuery.parse(req.query);
    const items = await kpi.listCosEotRecords(limit + 1, offset);
    const hasMore = items.length > limit;
    res.json({
      items: hasMore ? items.slice(0, limit) : items,
      nextOffset: hasMore ? offset + limit : null,
    });
  } catch (err) {
    next(err);
  }
});
