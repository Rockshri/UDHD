/**
 * Single-project "snapshot" export for the MD Portfolio Briefing modal.
 *
 * When an MD drills into a project on the modal (activeProjectId), they
 * see a "Project Snapshot" panel: Basic Info + Contract + Progress +
 * Dates + GeoTag + O&M. This service produces the same view as a
 * printable one-page PDF or a single-row Excel workbook.
 *
 * Excel output uses the same import-template schema (5 sheets, 1 filled
 * row on Project Register) so the snapshot can round-trip through the
 * bulk import if needed.
 */

import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  cosEotItem, division, geoPhoto, managementActionItem, project, projectScheme,
  region, scheme, sector,
} from '../db/schema.js';
import type { AuditActor } from '../lib/audit.js';
import { HttpError } from '../middleware/errorHandler.js';
import {
  exportProjectsToXlsx, type ExportFilters,
} from './projectExportService.js';

// ─── Types ───────────────────────────────────────────────────────────────

export interface SnapshotContext {
  projectId: string;
  projectName: string;
  generatedAt: Date;
}

// ─── Data fetch ──────────────────────────────────────────────────────────

interface SnapshotData {
  project: Record<string, unknown>;
  sectorName: string | null;
  divisionName: string | null;
  regionName: string | null;
  schemes: string[];
  cosItems: Array<Record<string, unknown>>;
  mgmtItems: Array<Record<string, unknown>>;
  geoPhotos: Array<Record<string, unknown>>;
}

async function loadSnapshot(projectId: string, pdDivisionId: number | null): Promise<SnapshotData> {
  const rows = await db.select().from(project).where(eq(project.projectId, projectId)).limit(1);
  const p = rows[0];
  if (!p) throw new HttpError(404, 'NOT_FOUND', `Project ${projectId} not found`);
  // PD scope: reject if the drilled project belongs to a different division.
  if (pdDivisionId !== null && p.divisionId !== pdDivisionId) {
    throw new HttpError(403, 'FORBIDDEN', 'Project outside your assigned division');
  }

  const [sectorRows, divisionRows, regionRows, schemesRows, cosRows, mgmtRows, geoRows, psRows] = await Promise.all([
    db.select().from(sector),
    db.select().from(division),
    db.select().from(region),
    db.select().from(scheme),
    db.select().from(cosEotItem).where(eq(cosEotItem.projectId, projectId)),
    db.select().from(managementActionItem).where(eq(managementActionItem.projectId, projectId)),
    db.select().from(geoPhoto).where(eq(geoPhoto.projectId, projectId)),
    db.select().from(projectScheme).where(eq(projectScheme.projectId, projectId)),
  ]);

  const sectorName = typeof p.sectorId === 'number'
    ? sectorRows.find((s) => s.sectorId === p.sectorId)?.sectorName ?? null
    : null;
  const div = typeof p.divisionId === 'number'
    ? divisionRows.find((d) => d.divisionId === p.divisionId)
    : null;
  const divisionName = div?.divisionName ?? null;
  const regionName = div
    ? regionRows.find((r) => r.regionId === div.regionId)?.regionName ?? null
    : null;

  const schemeNameById = new Map(schemesRows.map((s) => [s.schemeId, s.schemeName]));
  const schemes = psRows.map((r) => schemeNameById.get(r.schemeId)).filter((n): n is string => Boolean(n));

  return {
    project: p as unknown as Record<string, unknown>,
    sectorName,
    divisionName,
    regionName,
    schemes,
    cosItems: cosRows as unknown as Array<Record<string, unknown>>,
    mgmtItems: mgmtRows as unknown as Array<Record<string, unknown>>,
    geoPhotos: geoRows as unknown as Array<Record<string, unknown>>,
  };
}

// ─── Excel (reuses import-template shape via projectExportService) ───────

export async function exportProjectSnapshotToXlsx(
  projectId: string, actor: AuditActor, pdDivisionId: number | null,
): Promise<{ buffer: Buffer; ctx: SnapshotContext }> {
  // Verify + fetch the project name for the filename.
  const data = await loadSnapshot(projectId, pdDivisionId);
  const filters: ExportFilters = { projectIds: [projectId] };
  const buffer = await exportProjectsToXlsx(filters, actor, pdDivisionId);
  return {
    buffer,
    ctx: {
      projectId,
      projectName: String(data.project.projectName ?? projectId),
      generatedAt: new Date(),
    },
  };
}

// ─── PDF (single-project fielded card) ───────────────────────────────────

export async function exportProjectSnapshotToPdf(
  projectId: string, _actor: AuditActor, pdDivisionId: number | null,
): Promise<{ buffer: Buffer; ctx: SnapshotContext }> {
  void _actor;
  const data = await loadSnapshot(projectId, pdDivisionId);
  const p = data.project;
  const ctx: SnapshotContext = {
    projectId,
    projectName: String(p.projectName ?? projectId),
    generatedAt: new Date(),
  };

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4', layout: 'portrait', margin: 40,
      info: { Title: `Project Snapshot — ${ctx.projectName}`, Creator: 'BUIDCO Dashboard' },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), ctx }));
    doc.on('error', reject);
    drawSnapshotPdf(doc, data, ctx);
    doc.end();
  });
}

function drawSnapshotPdf(doc: PDFKit.PDFDocument, data: SnapshotData, ctx: SnapshotContext): void {
  const p = data.project;

  // ── Title band ──
  const bandH = 60;
  doc.rect(0, 0, doc.page.width, bandH).fill('#1E3A5F');
  doc.fillColor('#93C5FD').fontSize(9).font('Helvetica-Bold')
    .text('📊 MD PORTFOLIO BRIEFING · PROJECT SNAPSHOT', doc.page.margins.left, 14, { width: doc.page.width - 80 });
  doc.fillColor('#FFFFFF').fontSize(16).font('Helvetica-Bold')
    .text(ctx.projectName, doc.page.margins.left, 30, { width: doc.page.width - 80, ellipsis: true });
  doc.fillColor('#111827');
  doc.y = bandH + 12;

  // ── Metadata strip ──
  doc.fontSize(8).fillColor('#6B7280').font('Helvetica-Oblique')
    .text(
      `Generated ${fmtDate(ctx.generatedAt)}  ·  Project ID: ${ctx.projectId}`,
      { align: 'left' },
    );
  doc.moveDown(0.4);

  // ── Sections ──
  drawSection(doc, 'Basic Info', [
    ['Sector',              data.sectorName ?? '—'],
    ['Region',              data.regionName ?? '—'],
    ['Division',            data.divisionName ?? '—'],
    ['City',                str(p.city)],
    ['Contractor',          str(p.contractor)],
    ['PD',                  str(p.pd)],
    ['Contract Type',       str(p.contractType)],
    ['Sponsoring Dept.',    str(p.sponsoringDept)],
    ['Implementing Agency', str(p.implementingAgency)],
    ['Sanction Date',       fmtDateCell(p.sanctionDate)],
    ['Schemes',             data.schemes.length > 0 ? data.schemes.join(', ') : '—'],
  ]);

  if (p.mainWork || p.projectBrief) {
    drawTextBlock(doc, 'Main Work',    str(p.mainWork));
    drawTextBlock(doc, 'Project Brief', str(p.projectBrief));
  }

  drawSection(doc, 'Phase, Status & Dates', [
    ['Project Stage',   str(p.projectStageV2)],
    ['Status',          str(p.status)],
    ['Planned End',     fmtDateCell(p.plannedEndDate)],
    ['Revised End',     fmtDateCell(p.revisedEndDate)],
    ['Delay Reason',    str(p.delayReason)],
    ['Stuck At',        str(p.deptStuckAt)],
  ]);

  drawSection(doc, 'Progress & Financial', [
    ['AA Amount (₹ Cr)',       money(p.aaAmountCr)],
    ['Revised AA (₹ Cr)',      money(p.revisedAaAmountCr)],
    ['Agreement Amt (₹ Cr)',   money(p.agreementAmountCr)],
    ['Fin. Progress (₹ Cr)',   money(p.financialProgressCr)],
    ['Physical %',              pct(p.physicalProgressPct)],
    ['Scheduled %',             pct(p.scheduledProgressPct)],
    ['Financial %',             pct(p.financialProgressPct)],
    ['Priority',                str(p.priority)],
  ]);

  drawSection(doc, 'Contract & Financial Security', [
    ['Agreement Number',      str(p.agreementNumber)],
    ['Agreement Date',        fmtDateCell(p.agreementDate)],
    ['Appointed Date',        fmtDateCell(p.appointedDate)],
    ['Contract Value (₹ Cr)', money(p.contractValueCr)],
    ['PBG Number',            str(p.pbgNumber)],
    ['PBG Amount (₹ Cr)',     money(p.pbgAmountCr)],
    ['PBG Expiry',            fmtDateCell(p.pbgExpiryDate)],
    ['EMD (₹ Cr)',            money(p.emdAmountCr)],
    ['Total Payments (₹ Cr)', money(p.totalPaymentsCr)],
    ['Last Payment',          fmtDateCell(p.lastPaymentDate)],
  ]);

  // Only show O&M block if applicable.
  if (p.omApplicable === true || p.omStartDate || p.omPeriodMonths) {
    drawSection(doc, 'O&M', [
      ['O&M Applicable',   p.omApplicable === true ? 'Yes' : p.omApplicable === false ? 'No' : '—'],
      ['O&M Start',        fmtDateCell(p.omStartDate)],
      ['O&M Period (mo.)', str(p.omPeriodMonths)],
      ['O&M End',          fmtDateCell(p.omEndDate)],
      ['O&M Agency',       str(p.omAgency)],
      ['O&M Status',       str(p.omStatusOverride)],
    ]);
  }

  // GeoTag URL
  if (p.geoTaggingUrl) {
    drawTextBlock(doc, 'GeoTag URL', str(p.geoTaggingUrl));
  }

  // Counts of child data (with a small table sample if there's room).
  if (data.cosItems.length > 0 || data.mgmtItems.length > 0 || data.geoPhotos.length > 0) {
    drawSection(doc, 'Related Data', [
      ['CoS/EoT entries',       String(data.cosItems.length)],
      ['Management actions',    String(data.mgmtItems.length)],
      ['Geo photos',            String(data.geoPhotos.length)],
    ]);
  }

  // Footer band
  doc.fillColor('#9CA3AF').fontSize(8).font('Helvetica-Oblique')
    .text('BUIDCO Dashboard · Project Snapshot',
      doc.page.margins.left,
      doc.page.height - 30,
      { width: doc.page.width - 80, align: 'center' });
}

function drawSection(doc: PDFKit.PDFDocument, title: string, rows: Array<[string, string]>): void {
  const x = doc.page.margins.left;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  // Section header bar
  doc.rect(x, doc.y, w, 18).fill('#DCE6F1');
  doc.fillColor('#1E3A5F').fontSize(10).font('Helvetica-Bold')
    .text(title, x + 6, doc.y + 4, { width: w - 12 });
  doc.y = doc.y + 20;

  // 2-column grid: label(38% width) | value(62%)
  const rowH = 15;
  const labelW = w * 0.38;
  const valueW = w * 0.62;
  for (const [label, value] of rows) {
    if (doc.y > doc.page.height - doc.page.margins.bottom - rowH - 20) {
      doc.addPage();
    }
    doc.rect(x, doc.y, labelW, rowH).stroke('#E5E7EB');
    doc.rect(x + labelW, doc.y, valueW, rowH).stroke('#E5E7EB');
    doc.fontSize(8).fillColor('#6B7280').font('Helvetica-Bold')
      .text(label, x + 5, doc.y + 3, { width: labelW - 10 });
    doc.fontSize(9).fillColor('#111827').font('Helvetica')
      .text(value || '—', x + labelW + 5, doc.y + 3, { width: valueW - 10, ellipsis: true });
    doc.y += rowH;
  }
  doc.moveDown(0.3);
}

function drawTextBlock(doc: PDFKit.PDFDocument, label: string, value: string): void {
  if (!value || value === '—') return;
  const x = doc.page.margins.left;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.fontSize(8).fillColor('#6B7280').font('Helvetica-Bold').text(label, x, doc.y);
  doc.moveDown(0.1);
  doc.fontSize(9).fillColor('#111827').font('Helvetica')
    .text(value, x, doc.y, { width: w });
  doc.moveDown(0.3);
}

// ─── Formatting helpers ──────────────────────────────────────────────────

function str(v: unknown): string {
  if (v === null || v === undefined) return '—';
  return String(v).trim() || '—';
}
function money(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? `₹ ${n.toFixed(2)} Cr` : '—';
}
function pct(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : '—';
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateCell(v: unknown): string {
  if (!v) return '—';
  if (v instanceof Date) return fmtDate(v);
  const s = String(v);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : fmtDate(d);
}

/** Filename stem for both formats. */
export function snapshotFilenameStem(ctx: SnapshotContext): string {
  const slug = ctx.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  const ymd = ctx.generatedAt.toISOString().slice(0, 10);
  return `project-snapshot_${slug || 'project'}_${ymd}`;
}

// Silence unused-import lints for ExcelJS since we don't build a workbook
// directly in this file (reused via projectExportService for XLSX path).
void ExcelJS;
