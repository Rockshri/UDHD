import { Router } from 'express';
import { z } from 'zod';
import { sessionDivisionId } from '../lib/actor.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  briefingFilenameStem,
  exportMdBriefingToPdf,
  exportMdBriefingToPptx,
  exportMdBriefingToXlsx,
  type MdBriefingFilters,
} from '../services/mdBriefingExportService.js';

/**
 * MD Portfolio Briefing export — one endpoint, three formats.
 *
 * MD-only. Accepts the same 4 filters the modal exposes (schemeId,
 * sectorId, divisionId, status) and returns a summary-focused document
 * (Excel / PDF / PPTX) containing:
 *   - Filter context (which scheme / sector / division / status)
 *   - Portfolio KPIs (totals, averages, status + stage breakdown)
 *   - Filtered project list (up to 100 rows — matches modal cap)
 *
 * `Content-Disposition` includes a filename derived from the filters so
 * MDs get self-describing files when they download multiple views.
 */
export const mdBriefingExportRouter = Router();

// MD-only per spec ("MD Portfolio Briefing" — Admin/PD/Viewer denied).
mdBriefingExportRouter.use(requireAuth, requireRole('MD'));

const filtersSchema = z.object({
  format: z.enum(['xlsx', 'pdf', 'pptx']),
  schemeId:   z.coerce.number().int().positive().optional(),
  sectorId:   z.coerce.number().int().positive().optional(),
  divisionId: z.coerce.number().int().positive().optional(),
  status:     z.string().min(1).max(60).optional(),
});

mdBriefingExportRouter.get('/export', async (req, res, next) => {
  try {
    const q = filtersSchema.parse(req.query);
    const filters: MdBriefingFilters = {};
    if (q.schemeId   !== undefined) filters.schemeId   = q.schemeId;
    if (q.sectorId   !== undefined) filters.sectorId   = q.sectorId;
    if (q.divisionId !== undefined) filters.divisionId = q.divisionId;
    if (q.status     !== undefined) filters.status     = q.status;

    const pdDivisionId = sessionDivisionId(req);

    let out: { buffer: Buffer; ctx: Awaited<ReturnType<typeof exportMdBriefingToXlsx>>['ctx'] };
    let mime: string;
    let ext: string;
    if (q.format === 'xlsx') {
      out = await exportMdBriefingToXlsx(filters, pdDivisionId);
      mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      ext = 'xlsx';
    } else if (q.format === 'pdf') {
      out = await exportMdBriefingToPdf(filters, pdDivisionId);
      mime = 'application/pdf';
      ext = 'pdf';
    } else {
      out = await exportMdBriefingToPptx(filters, pdDivisionId);
      mime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      ext = 'pptx';
    }

    const filename = `${briefingFilenameStem(out.ctx)}.${ext}`;
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(out.buffer.length));
    res.status(200).end(out.buffer);
  } catch (err) {
    next(err);
  }
});
