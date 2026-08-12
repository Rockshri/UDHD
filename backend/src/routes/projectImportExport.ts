import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { actorFromReq, sessionDivisionId } from '../lib/actor.js';
import { requireAuth, requireRole, requireWriter } from '../middleware/auth.js';
import {
  IMPORT_LIMITS, PROJECT_REGISTER_SHEET, TEMPLATE_DISPLAY_NAME,
} from '../lib/importTemplate.js';
import {
  exportProjectsToPdf, exportProjectsToPptx, exportProjectsToXlsx,
  generateBlankTemplateXlsx, type ExportFilters,
} from '../services/projectExportService.js';
import { importProjects, type ImportMode } from '../services/projectImportService.js';
import {
  exportProjectSnapshotToPdf, exportProjectSnapshotToXlsx,
  snapshotFilenameStem,
} from '../services/projectSnapshotService.js';

/**
 * Project import + export routes.
 *
 *   GET  /projects/template.xlsx         — download blank template (auth-only)
 *   POST /projects/import                — multipart upload; ?mode=preview|commit
 *                                          (import gated to MD/Admin — matches
 *                                          createProject's Fixed-Input rule)
 *   GET  /projects/export                — ?format=xlsx|pdf|pptx&filters...
 *                                          (auth-only; PD scoped to division)
 */
export const projectImportExportRouter = Router();

// Multer: in-memory upload, single .xlsx file, size-capped.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMPORT_LIMITS.MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    const okMime = (IMPORT_LIMITS.ACCEPTED_MIMES as readonly string[]).includes(file.mimetype);
    const okExt = /\.xlsx$/i.test(file.originalname);
    if (okMime || okExt) cb(null, true);
    else cb(new Error('Only .xlsx files are accepted'));
  },
});

projectImportExportRouter.use(requireAuth);

// ─── GET /projects/template.xlsx — blank template download ─────────────
projectImportExportRouter.get('/template.xlsx', async (_req, res, next) => {
  try {
    const buf = await generateBlankTemplateXlsx();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${TEMPLATE_DISPLAY_NAME.replace(/\s+/g, '_')}_template.xlsx"`,
    );
    res.setHeader('Content-Length', String(buf.length));
    res.status(200).end(buf);
  } catch (err) {
    next(err);
  }
});

// ─── POST /projects/import — MD/Admin only ─────────────────────────────
const importQuerySchema = z.object({
  mode: z.enum(['preview', 'commit']).default('preview'),
});

projectImportExportRouter.post(
  '/import',
  requireRole('MD', 'Admin'),
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: { code: 'NO_FILE', message: 'Missing "file" field (multipart).' } });
        return;
      }
      const { mode } = importQuerySchema.parse(req.query) as { mode: ImportMode };
      const summary = await importProjects(
        req.file.buffer, actorFromReq(req), mode, req.file.originalname,
      );
      res.json(summary);
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /projects/export — Excel / PDF / PPTX ─────────────────────────
const exportQuerySchema = z.object({
  format: z.enum(['xlsx', 'pdf', 'pptx']),
  search:       z.string().min(1).max(200).optional(),
  status:       z.string().min(1).max(60).optional(),
  projectStage: z.string().min(1).max(60).optional(),
  contractType: z.string().min(1).max(60).optional(),
  sectorId:     z.coerce.number().int().positive().optional(),
  divisionId:   z.coerce.number().int().positive().optional(),
  regionId:     z.coerce.number().int().positive().optional(),
  schemeId:     z.coerce.number().int().positive().optional(),
  /** Comma-separated project IDs for multi-select export. */
  projectIds:   z.string().min(1).max(6000).optional(),
});

projectImportExportRouter.get('/export', async (req, res, next) => {
  try {
    const q = exportQuerySchema.parse(req.query);
    const filters: ExportFilters = {};
    if (q.search)       filters.search       = q.search;
    if (q.status)       filters.status       = q.status;
    if (q.projectStage) filters.projectStage = q.projectStage;
    if (q.contractType) filters.contractType = q.contractType;
    if (q.sectorId     !== undefined) filters.sectorId   = q.sectorId;
    if (q.divisionId   !== undefined) filters.divisionId = q.divisionId;
    if (q.regionId     !== undefined) filters.regionId   = q.regionId;
    if (q.schemeId     !== undefined) filters.schemeId   = q.schemeId;
    if (q.projectIds) {
      filters.projectIds = q.projectIds.split(',').map((s) => s.trim()).filter(Boolean);
    }

    const actor = actorFromReq(req);
    const pdDivisionId = sessionDivisionId(req);

    let buf: Buffer;
    let mime: string;
    let ext: string;
    if (q.format === 'xlsx') {
      buf = await exportProjectsToXlsx(filters, actor, pdDivisionId);
      mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      ext = 'xlsx';
    } else if (q.format === 'pdf') {
      buf = await exportProjectsToPdf(filters, actor, pdDivisionId);
      mime = 'application/pdf';
      ext = 'pdf';
    } else {
      buf = await exportProjectsToPptx(filters, actor, pdDivisionId);
      mime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      ext = 'pptx';
    }

    // Suffix filename with a date so multiple exports don't collide.
    const stem = `${PROJECT_REGISTER_SHEET.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${stem}.${ext}"`);
    res.setHeader('Content-Length', String(buf.length));
    res.status(200).end(buf);
  } catch (err) {
    next(err);
  }
});

// ─── GET /projects/:projectId/snapshot?format=xlsx|pdf — MD-only single-project ──
const snapshotQuerySchema = z.object({
  format: z.enum(['xlsx', 'pdf']),
});
const snapshotParamSchema = z.object({
  projectId: z.string().min(1).max(60),
});

// MD-only — matches the MD Portfolio Briefing surface where this action
// lives. Admin/PD/Viewer can use the general /export flow instead.
projectImportExportRouter.get(
  '/:projectId/snapshot',
  requireRole('MD'),
  async (req, res, next) => {
    try {
      const { projectId } = snapshotParamSchema.parse(req.params);
      const { format } = snapshotQuerySchema.parse(req.query);
      const actor = actorFromReq(req);
      const pdDivisionId = sessionDivisionId(req);

      let out: Awaited<ReturnType<typeof exportProjectSnapshotToPdf>>;
      let mime: string;
      let ext: string;
      if (format === 'xlsx') {
        out = await exportProjectSnapshotToXlsx(projectId, actor, pdDivisionId);
        mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        ext = 'xlsx';
      } else {
        out = await exportProjectSnapshotToPdf(projectId, actor, pdDivisionId);
        mime = 'application/pdf';
        ext = 'pdf';
      }
      const filename = `${snapshotFilenameStem(out.ctx)}.${ext}`;
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', String(out.buffer.length));
      res.status(200).end(out.buffer);
    } catch (err) {
      next(err);
    }
  },
);

// Silence unused-import warnings for requireWriter (route is auth-only, not
// writer-scoped — export is available to Viewers too).
void requireWriter;
