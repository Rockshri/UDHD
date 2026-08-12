/**
 * MD Portfolio Briefing export service.
 *
 * Generates a summary-focused document (Excel / PDF / PPTX) for the
 * currently-viewed slice of the MD Portfolio modal. "Currently viewed"
 * = whatever combination of the 4 filters (schemeId, sectorId, divisionId,
 * status) the MD has narrowed the modal down to.
 *
 * Every format contains the same two blocks:
 *   1. Summary — filter context (which scheme/sector/division/status the
 *      MD is looking at) plus aggregate KPIs computed from the filtered
 *      projects.
 *   2. Project list — one row per matching project (up to 100, matching
 *      the modal's server-side cap).
 *
 * Self-contained: does not depend on any other export service. Reuses
 * `listProjects` + `getLookups` so the exported slice is guaranteed to
 * match what the modal shows.
 */

import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import PptxGenJSDefault from 'pptxgenjs';
import { listProjects, type ListProjectsQuery, type ProjectListItem } from './projectsService.js';
import { getLookups, type LookupsResponse } from './lookupsService.js';

// pptxgenjs: default export IS the constructor at runtime but its .d.ts
// combines the class with `export as namespace`, confusing tsc. Cast to a
// plain constructor sig — verified working at runtime via `new PptxGenJS()`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PptxGenJS = PptxGenJSDefault as unknown as new () => any;

/** The 4 filters the modal exposes — mirror of MdSchemeSummaryModal state. */
export interface MdBriefingFilters {
  schemeId?: number;
  sectorId?: number;
  divisionId?: number;
  status?: string;
}

/** Summary numbers aggregated from the filtered project list. */
interface Summary {
  totalCount: number;
  aaAmountCr: number;
  revisedAaAmountCr: number;
  sanctionedCostCr: number;
  agreementAmountCr: number;
  financialSpentCr: number;
  avgPhysicalPct: number | null;
  avgFinancialPct: number | null;
  statusBreakdown: Record<string, number>;
  stageBreakdown: Record<string, number>;
}

/** Filter context resolved to human-readable labels for the exported header. */
interface Context {
  schemeName: string | null;
  sectorName: string | null;
  divisionName: string | null;
  status: string | null;
  generatedAt: Date;
}

// ─── Shared pipeline: fetch + aggregate ───────────────────────────────────

async function loadSlice(
  filters: MdBriefingFilters,
  pdDivisionId: number | null,
): Promise<{ items: ProjectListItem[]; summary: Summary; ctx: Context; lookups: LookupsResponse }> {
  // 100 = modal's max (matches the ListProjectsQuery cap).
  const q: ListProjectsQuery = { limit: 100 };
  if (filters.schemeId !== undefined) q.schemeId = filters.schemeId;
  if (filters.sectorId !== undefined) q.sectorId = filters.sectorId;
  if (filters.divisionId !== undefined) q.divisionId = filters.divisionId;
  if (filters.status !== undefined) q.status = filters.status;

  const [projectsPage, lookups] = await Promise.all([
    listProjects(q, pdDivisionId),
    getLookups(),
  ]);
  const items = projectsPage.items;

  const summary = aggregate(items);
  const ctx: Context = {
    schemeName: filters.schemeId !== undefined
      ? lookups.schemes.find((s) => s.schemeId === filters.schemeId)?.schemeName ?? `#${filters.schemeId}`
      : null,
    sectorName: filters.sectorId !== undefined
      ? lookups.sectors.find((s) => s.sectorId === filters.sectorId)?.sectorName ?? `#${filters.sectorId}`
      : null,
    divisionName: filters.divisionId !== undefined
      ? lookups.divisions.find((d) => d.divisionId === filters.divisionId)?.divisionName ?? `#${filters.divisionId}`
      : null,
    status: filters.status ?? null,
    generatedAt: new Date(),
  };
  return { items, summary, ctx, lookups };
}

function aggregate(items: ProjectListItem[]): Summary {
  const sum = (fn: (i: ProjectListItem) => number | null): number =>
    items.reduce((acc, it) => acc + (fn(it) ?? 0), 0);
  const avg = (fn: (i: ProjectListItem) => number | null): number | null => {
    const vals = items.map(fn).filter((v): v is number => typeof v === 'number');
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const statusBreakdown: Record<string, number> = {};
  const stageBreakdown: Record<string, number> = {};
  for (const it of items) {
    const s = it.status ?? '—';
    statusBreakdown[s] = (statusBreakdown[s] ?? 0) + 1;
    const stg = it.projectStageV2 ?? '—';
    stageBreakdown[stg] = (stageBreakdown[stg] ?? 0) + 1;
  }

  const aa       = sum((i) => i.aaAmountCr);
  const revAa    = sum((i) => i.revisedAaAmountCr);
  const agr      = sum((i) => i.agreementAmountCr);
  const spent    = sum((i) => i.financialProgressCr);
  // Sanctioned cost per project = revised AA if set, else AA (matches the
  // UI's deriveSanctionedCost logic in ProgressFinancialSection).
  const sanctioned = items.reduce((acc, it) =>
    acc + (it.revisedAaAmountCr ?? it.aaAmountCr ?? 0), 0);

  return {
    totalCount: items.length,
    aaAmountCr: aa,
    revisedAaAmountCr: revAa,
    sanctionedCostCr: sanctioned,
    agreementAmountCr: agr,
    financialSpentCr: spent,
    avgPhysicalPct: avg((i) => i.physicalProgressPct),
    avgFinancialPct: avg((i) => i.financialProgressPct),
    statusBreakdown,
    stageBreakdown,
  };
}

// ─── Formatting helpers ───────────────────────────────────────────────────

const money = (n: number): string => `₹ ${n.toFixed(2)} Cr`; // ₹ prefix
const pct = (n: number | null): string => (n === null ? '—' : `${n.toFixed(1)}%`);
const fmtDate = (d: Date): string =>
  d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/** Human-readable header line describing what slice this document represents. */
function contextLine(ctx: Context): string {
  const parts: string[] = [];
  if (ctx.schemeName)   parts.push(`Scheme: ${ctx.schemeName}`);
  if (ctx.sectorName)   parts.push(`Sector: ${ctx.sectorName}`);
  if (ctx.divisionName) parts.push(`Division: ${ctx.divisionName}`);
  if (ctx.status)       parts.push(`Status: ${ctx.status}`);
  return parts.length > 0 ? parts.join(' · ') : 'Full portfolio (no filters)';
}

/** Suggested filename stem (caller adds the extension). */
export function briefingFilenameStem(ctx: Context): string {
  const slug = (s: string): string =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const parts: string[] = ['md-briefing'];
  if (ctx.schemeName)   parts.push(slug(ctx.schemeName));
  if (ctx.sectorName)   parts.push(slug(ctx.sectorName));
  if (ctx.divisionName) parts.push(slug(ctx.divisionName));
  const ymd = ctx.generatedAt.toISOString().slice(0, 10);
  return [...parts, ymd].filter(Boolean).join('_');
}

// ─── Excel export ─────────────────────────────────────────────────────────

const HEADER_BG = 'FF1E3A5F';
const SUBHEAD_BG = 'FFDCE6F1';
const BORDER_ARGB = 'FFD1D5DB';
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top:    { style: 'thin', color: { argb: BORDER_ARGB } },
  bottom: { style: 'thin', color: { argb: BORDER_ARGB } },
  left:   { style: 'thin', color: { argb: BORDER_ARGB } },
  right:  { style: 'thin', color: { argb: BORDER_ARGB } },
};

export async function exportMdBriefingToXlsx(
  filters: MdBriefingFilters,
  pdDivisionId: number | null,
): Promise<{ buffer: Buffer; ctx: Context }> {
  const { items, summary, ctx, lookups } = await loadSlice(filters, pdDivisionId);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BUIDCO Dashboard';
  wb.created = ctx.generatedAt;

  // Sheet 1 — Summary
  const s1 = wb.addWorksheet('Summary');
  s1.getColumn(1).width = 32;
  s1.getColumn(2).width = 28;

  writeXlsxTitle(s1, 1, 'MD Portfolio Briefing');
  writeXlsxSub(s1, 2, contextLine(ctx));
  writeXlsxSub(s1, 3, `Generated: ${fmtDate(ctx.generatedAt)}`);

  writeXlsxSectionHeader(s1, 5, 'Portfolio KPIs');
  writeKvRow(s1, 6, 'Total projects', String(summary.totalCount));
  writeKvRow(s1, 7, 'AA Amount', money(summary.aaAmountCr));
  writeKvRow(s1, 8, 'Revised AA Amount', money(summary.revisedAaAmountCr));
  writeKvRow(s1, 9, 'Sanctioned Cost (derived)', money(summary.sanctionedCostCr));
  writeKvRow(s1, 10, 'Agreement Amount', money(summary.agreementAmountCr));
  writeKvRow(s1, 11, 'Financial Progress (spent)', money(summary.financialSpentCr));
  writeKvRow(s1, 12, 'Avg. Physical Progress', pct(summary.avgPhysicalPct));
  writeKvRow(s1, 13, 'Avg. Financial Progress', pct(summary.avgFinancialPct));

  let row = 15;
  writeXlsxSectionHeader(s1, row, 'Status Breakdown');
  row++;
  for (const [k, v] of Object.entries(summary.statusBreakdown)) {
    writeKvRow(s1, row++, k, String(v));
  }
  row++;
  writeXlsxSectionHeader(s1, row, 'Stage Breakdown');
  row++;
  for (const [k, v] of Object.entries(summary.stageBreakdown)) {
    writeKvRow(s1, row++, k, String(v));
  }

  // Sheet 2 — Project list
  const s2 = wb.addWorksheet('Projects');
  writeProjectsSheet(s2, items, lookups);

  const buf = await wb.xlsx.writeBuffer();
  return { buffer: Buffer.from(buf), ctx };
}

function writeXlsxTitle(s: ExcelJS.Worksheet, row: number, text: string): void {
  s.mergeCells(row, 1, row, 2);
  const c = s.getCell(row, 1);
  c.value = text;
  c.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
  c.alignment = { horizontal: 'center', vertical: 'middle' };
  s.getRow(row).height = 28;
}
function writeXlsxSub(s: ExcelJS.Worksheet, row: number, text: string): void {
  s.mergeCells(row, 1, row, 2);
  const c = s.getCell(row, 1);
  c.value = text;
  c.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF6B7280' } };
  c.alignment = { horizontal: 'center', vertical: 'middle' };
}
function writeXlsxSectionHeader(s: ExcelJS.Worksheet, row: number, text: string): void {
  s.mergeCells(row, 1, row, 2);
  const c = s.getCell(row, 1);
  c.value = text;
  c.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1E3A5F' } };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBHEAD_BG } };
  c.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  c.border = THIN_BORDER;
}
function writeKvRow(s: ExcelJS.Worksheet, row: number, k: string, v: string): void {
  const a = s.getCell(row, 1);
  a.value = k;
  a.font = { name: 'Arial', size: 10, bold: true };
  a.border = THIN_BORDER;
  const b = s.getCell(row, 2);
  b.value = v;
  b.font = { name: 'Arial', size: 10 };
  b.border = THIN_BORDER;
  b.alignment = { horizontal: 'right' };
}

function writeProjectsSheet(
  s: ExcelJS.Worksheet,
  items: ProjectListItem[],
  lookups: LookupsResponse,
): void {
  const headers = [
    '#', 'Project Name', 'Sector', 'Division', 'Contract Type',
    'Project Stage', 'Status', 'AA Amount (₹ Cr)', 'Revised AA (₹ Cr)',
    'Agreement Amount (₹ Cr)', 'Financial Spent (₹ Cr)',
    'Physical %', 'Financial %', 'Planned End', 'Revised End',
  ];
  const widths = [5, 40, 16, 20, 16, 16, 14, 18, 18, 20, 20, 12, 12, 14, 14];

  for (let i = 0; i < headers.length; i++) {
    const c = s.getCell(1, i + 1);
    c.value = headers[i] ?? '';
    c.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = THIN_BORDER;
    s.getColumn(i + 1).width = widths[i] ?? 14;
  }
  s.getRow(1).height = 30;

  const sectorName = (id: number | null): string =>
    id === null ? '' : lookups.sectors.find((x) => x.sectorId === id)?.sectorName ?? `#${id}`;
  const divisionName = (id: number | null): string =>
    id === null ? '' : lookups.divisions.find((x) => x.divisionId === id)?.divisionName ?? `#${id}`;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it) continue;
    const row = i + 2;
    const cells: unknown[] = [
      i + 1,
      it.projectName ?? '',
      sectorName(it.sectorId),
      divisionName(it.divisionId),
      it.contractType ?? '',
      it.projectStageV2 ?? '',
      it.status ?? '',
      it.aaAmountCr ?? null,
      it.revisedAaAmountCr ?? null,
      it.agreementAmountCr ?? null,
      it.financialProgressCr ?? null,
      it.physicalProgressPct ?? null,
      it.financialProgressPct ?? null,
      it.plannedEndDate ?? '',
      it.revisedEndDate ?? '',
    ];
    for (let c = 0; c < cells.length; c++) {
      const cell = s.getCell(row, c + 1);
      cell.value = cells[c] as ExcelJS.CellValue;
      cell.font = { name: 'Arial', size: 10 };
      cell.border = THIN_BORDER;
      if (c === 0) cell.alignment = { horizontal: 'center' };
      if (c >= 7 && c <= 10) cell.numFmt = '#,##0.00';
      if (c === 11 || c === 12) cell.numFmt = '0.0"%"';
    }
  }
  s.views = [{ state: 'frozen', ySplit: 1 }];
}

// ─── PDF export ───────────────────────────────────────────────────────────

export async function exportMdBriefingToPdf(
  filters: MdBriefingFilters,
  pdDivisionId: number | null,
): Promise<{ buffer: Buffer; ctx: Context }> {
  const { items, summary, ctx, lookups } = await loadSlice(filters, pdDivisionId);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 36,
      info: { Title: 'MD Portfolio Briefing', Creator: 'BUIDCO Dashboard' },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), ctx }));
    doc.on('error', reject);

    // ── Title block ──
    doc.fillColor('#1E3A5F').fontSize(18).font('Helvetica-Bold')
      .text('MD Portfolio Briefing', { align: 'center' });
    doc.moveDown(0.15);
    doc.fillColor('#6B7280').fontSize(10).font('Helvetica-Oblique')
      .text(contextLine(ctx), { align: 'center' });
    doc.fillColor('#6B7280').fontSize(9).font('Helvetica-Oblique')
      .text(`Generated: ${fmtDate(ctx.generatedAt)}`, { align: 'center' });
    doc.moveDown(0.7);

    // ── KPI grid ──
    drawPdfSectionHeader(doc, 'Portfolio KPIs');
    const kpiRows: Array<[string, string]> = [
      ['Total projects',              String(summary.totalCount)],
      ['AA Amount',                   money(summary.aaAmountCr)],
      ['Revised AA Amount',           money(summary.revisedAaAmountCr)],
      ['Sanctioned Cost',             money(summary.sanctionedCostCr)],
      ['Agreement Amount',            money(summary.agreementAmountCr)],
      ['Financial Spent',             money(summary.financialSpentCr)],
      ['Avg. Physical Progress',      pct(summary.avgPhysicalPct)],
      ['Avg. Financial Progress',     pct(summary.avgFinancialPct)],
    ];
    drawPdfKvGrid(doc, kpiRows);
    doc.moveDown(0.5);

    // ── Breakdowns ──
    drawPdfSectionHeader(doc, 'Status Breakdown');
    drawPdfKvGrid(doc, Object.entries(summary.statusBreakdown).map(([k, v]) => [k, String(v)]));
    doc.moveDown(0.5);
    drawPdfSectionHeader(doc, 'Stage Breakdown');
    drawPdfKvGrid(doc, Object.entries(summary.stageBreakdown).map(([k, v]) => [k, String(v)]));
    doc.moveDown(0.7);

    // ── Project list (new page) ──
    doc.addPage();
    doc.fillColor('#1E3A5F').fontSize(14).font('Helvetica-Bold')
      .text(`Projects (${items.length})`, { align: 'left' });
    doc.moveDown(0.4);
    drawProjectsTablePdf(doc, items, lookups);

    doc.end();
  });
}

function drawPdfSectionHeader(doc: PDFKit.PDFDocument, text: string): void {
  const x = doc.page.margins.left;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.y;
  doc.rect(x, y, w, 18).fill('#DCE6F1');
  doc.fillColor('#1E3A5F').fontSize(10).font('Helvetica-Bold')
    .text(text, x + 6, y + 4, { width: w - 12 });
  doc.y = y + 20;
  doc.fillColor('#111827');
}

function drawPdfKvGrid(doc: PDFKit.PDFDocument, rows: Array<[string, string]>): void {
  const x0 = doc.page.margins.left;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const cols = 4;
  const cellW = w / cols;
  const rowH = 22;
  let col = 0;
  let y = doc.y;
  for (const [k, v] of rows) {
    const x = x0 + col * cellW;
    doc.rect(x, y, cellW, rowH).stroke('#D1D5DB');
    doc.fontSize(8).fillColor('#6B7280').font('Helvetica')
      .text(k, x + 6, y + 3, { width: cellW - 12 });
    doc.fontSize(11).fillColor('#111827').font('Helvetica-Bold')
      .text(v, x + 6, y + 11, { width: cellW - 12, ellipsis: true });
    col++;
    if (col >= cols) { col = 0; y += rowH; }
  }
  if (col !== 0) y += rowH;
  doc.y = y + 4;
}

function drawProjectsTablePdf(
  doc: PDFKit.PDFDocument,
  items: ProjectListItem[],
  lookups: LookupsResponse,
): void {
  const headers = ['#', 'Project Name', 'Sector', 'Division', 'Stage', 'Status', 'AA (Cr)', 'Agr. (Cr)', 'Spent (Cr)', 'Phys %', 'Fin %'];
  const widths  = [24,  180,           70,       90,         70,      60,       55,        60,          60,          40,        40];
  const x0 = doc.page.margins.left;
  const rowH = 16;
  let y = doc.y;

  // Header row
  drawTableRow(doc, headers, widths, x0, y, rowH, true);
  y += rowH;

  const sectorName = (id: number | null): string =>
    id === null ? '' : lookups.sectors.find((x) => x.sectorId === id)?.sectorName ?? `#${id}`;
  const divisionName = (id: number | null): string =>
    id === null ? '' : lookups.divisions.find((x) => x.divisionId === id)?.divisionName ?? `#${id}`;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it) continue;
    // Page-break check
    if (y > doc.page.height - doc.page.margins.bottom - rowH) {
      doc.addPage();
      y = doc.page.margins.top;
      drawTableRow(doc, headers, widths, x0, y, rowH, true);
      y += rowH;
    }
    const row = [
      String(i + 1),
      it.projectName ?? '',
      sectorName(it.sectorId),
      divisionName(it.divisionId),
      it.projectStageV2 ?? '',
      it.status ?? '',
      it.aaAmountCr !== null ? it.aaAmountCr.toFixed(2) : '',
      it.agreementAmountCr !== null ? it.agreementAmountCr.toFixed(2) : '',
      it.financialProgressCr !== null ? it.financialProgressCr.toFixed(2) : '',
      it.physicalProgressPct !== null ? it.physicalProgressPct.toFixed(1) : '',
      it.financialProgressPct !== null ? it.financialProgressPct.toFixed(1) : '',
    ];
    drawTableRow(doc, row, widths, x0, y, rowH, false);
    y += rowH;
  }
  doc.y = y;
}

function drawTableRow(
  doc: PDFKit.PDFDocument,
  cells: string[],
  widths: number[],
  x0: number,
  y: number,
  h: number,
  header: boolean,
): void {
  let x = x0;
  for (let i = 0; i < cells.length; i++) {
    const w = widths[i] ?? 60;
    if (header) doc.rect(x, y, w, h).fillAndStroke('#1E3A5F', '#D1D5DB');
    else        doc.rect(x, y, w, h).stroke('#D1D5DB');
    doc.fillColor(header ? '#FFFFFF' : '#111827')
      .fontSize(header ? 8.5 : 8)
      .font(header ? 'Helvetica-Bold' : 'Helvetica')
      .text(cells[i] ?? '', x + 3, y + 4, { width: w - 6, height: h - 4, ellipsis: true });
    x += w;
  }
}

// ─── PPTX export ──────────────────────────────────────────────────────────

export async function exportMdBriefingToPptx(
  filters: MdBriefingFilters,
  pdDivisionId: number | null,
): Promise<{ buffer: Buffer; ctx: Context }> {
  const { items, summary, ctx, lookups } = await loadSlice(filters, pdDivisionId);
  const pptx = new PptxGenJS();
  pptx.author = 'BUIDCO Dashboard';
  pptx.title = 'MD Portfolio Briefing';
  pptx.layout = 'LAYOUT_WIDE';

  // Cover slide
  const cover = pptx.addSlide();
  cover.background = { color: '1E3A5F' };
  cover.addText('MD Portfolio Briefing', {
    x: 0.5, y: 2.0, w: 12, h: 1.2,
    fontSize: 40, bold: true, color: 'FFFFFF', align: 'center', fontFace: 'Arial',
  });
  cover.addText(contextLine(ctx), {
    x: 0.5, y: 3.3, w: 12, h: 0.6,
    fontSize: 18, color: 'BFDBFE', align: 'center', italic: true, fontFace: 'Arial',
  });
  cover.addText(`Generated: ${fmtDate(ctx.generatedAt)}`, {
    x: 0.5, y: 6.5, w: 12, h: 0.4,
    fontSize: 12, color: '93C5FD', align: 'center', fontFace: 'Arial',
  });

  // KPI slide
  const kpi = pptx.addSlide();
  kpi.addText('Portfolio KPIs', {
    x: 0.5, y: 0.3, w: 12, h: 0.6,
    fontSize: 24, bold: true, color: '1E3A5F', fontFace: 'Arial',
  });
  const kpiRows: Array<[string, string]> = [
    ['Total projects',           String(summary.totalCount)],
    ['AA Amount',                money(summary.aaAmountCr)],
    ['Revised AA Amount',        money(summary.revisedAaAmountCr)],
    ['Sanctioned Cost',          money(summary.sanctionedCostCr)],
    ['Agreement Amount',         money(summary.agreementAmountCr)],
    ['Financial Spent',          money(summary.financialSpentCr)],
    ['Avg. Physical Progress',   pct(summary.avgPhysicalPct)],
    ['Avg. Financial Progress',  pct(summary.avgFinancialPct)],
  ];
  drawPptxKpiGrid(kpi, kpiRows, 0.5, 1.1);

  // Breakdown slide
  const brk = pptx.addSlide();
  brk.addText('Status & Stage Breakdown', {
    x: 0.5, y: 0.3, w: 12, h: 0.6,
    fontSize: 24, bold: true, color: '1E3A5F', fontFace: 'Arial',
  });
  brk.addText('Status', { x: 0.5, y: 1.0, w: 5.5, h: 0.4, fontSize: 14, bold: true, color: '374151', fontFace: 'Arial' });
  drawPptxKvList(brk, Object.entries(summary.statusBreakdown).map(([k, v]) => [k, String(v)]), 0.5, 1.4);
  brk.addText('Stage', { x: 6.5, y: 1.0, w: 5.5, h: 0.4, fontSize: 14, bold: true, color: '374151', fontFace: 'Arial' });
  drawPptxKvList(brk, Object.entries(summary.stageBreakdown).map(([k, v]) => [k, String(v)]), 6.5, 1.4);

  // Project list slide (single slide with table — matches "summary-focused")
  const list = pptx.addSlide();
  list.addText(`Projects (${items.length})`, {
    x: 0.5, y: 0.3, w: 12, h: 0.6,
    fontSize: 20, bold: true, color: '1E3A5F', fontFace: 'Arial',
  });
  drawPptxProjectsTable(list, items, lookups);

  const blob = await pptx.write({ outputType: 'nodebuffer' });
  return { buffer: blob as Buffer, ctx };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawPptxKpiGrid(slide: any, rows: Array<[string, string]>, x0: number, y0: number): void {
  const cols = 4;
  const cellW = 3.0;
  const cellH = 1.2;
  let col = 0;
  let y = y0;
  for (const [k, v] of rows) {
    const x = x0 + col * cellW;
    slide.addShape('rect', {
      x, y, w: cellW - 0.15, h: cellH - 0.1,
      fill: { color: 'F9FAFB' },
      line: { color: 'D1D5DB', width: 0.5 },
    });
    slide.addText(k, {
      x: x + 0.1, y: y + 0.08, w: cellW - 0.35, h: 0.35,
      fontSize: 10, color: '6B7280', fontFace: 'Arial',
    });
    slide.addText(v, {
      x: x + 0.1, y: y + 0.42, w: cellW - 0.35, h: 0.55,
      fontSize: 18, bold: true, color: '111827', fontFace: 'Arial',
    });
    col++;
    if (col >= cols) { col = 0; y += cellH; }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawPptxKvList(slide: any, rows: Array<[string, string]>, x: number, y0: number): void {
  const rowH = 0.35;
  let y = y0;
  for (const [k, v] of rows) {
    slide.addText(k, { x, y, w: 3.5, h: rowH, fontSize: 12, color: '374151', fontFace: 'Arial' });
    slide.addText(v, { x: x + 3.6, y, w: 1.0, h: rowH, fontSize: 12, bold: true, color: '111827', align: 'right', fontFace: 'Arial' });
    y += rowH;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawPptxProjectsTable(slide: any, items: ProjectListItem[], lookups: LookupsResponse): void {
  const sectorName = (id: number | null): string =>
    id === null ? '—' : lookups.sectors.find((x) => x.sectorId === id)?.sectorName ?? `#${id}`;
  const divisionName = (id: number | null): string =>
    id === null ? '—' : lookups.divisions.find((x) => x.divisionId === id)?.divisionName ?? `#${id}`;

  const headers = ['#', 'Project Name', 'Sector', 'Division', 'Stage', 'Status', 'AA (Cr)', 'Fin %'];
  // pptxgenjs table rows: [{ text, options }, ...]
  const headerCells = headers.map((h) => ({
    text: h,
    options: { bold: true, color: 'FFFFFF', fill: { color: '1E3A5F' }, fontSize: 10, fontFace: 'Arial' },
  }));
  // Table capacity ≈ 20 rows on a wide slide; cap here to avoid overflow.
  const cap = Math.min(items.length, 20);
  const bodyRows = items.slice(0, cap).map((it, i) => [
    { text: String(i + 1) },
    { text: it.projectName ?? '' },
    { text: sectorName(it.sectorId) },
    { text: divisionName(it.divisionId) },
    { text: it.projectStageV2 ?? '' },
    { text: it.status ?? '' },
    { text: it.aaAmountCr !== null ? it.aaAmountCr.toFixed(2) : '' },
    { text: it.financialProgressPct !== null ? it.financialProgressPct.toFixed(1) : '' },
  ]);
  slide.addTable([headerCells, ...bodyRows], {
    x: 0.4, y: 1.0, w: 12.5, h: 6.0,
    colW: [0.5, 3.8, 1.5, 2.0, 1.5, 1.4, 0.9, 0.8],
    fontSize: 9, fontFace: 'Arial',
    border: { pt: 0.5, color: 'D1D5DB' },
  });
  if (items.length > cap) {
    slide.addText(`(showing first ${cap} of ${items.length} projects — see Excel export for the full list)`, {
      x: 0.4, y: 7.1, w: 12.5, h: 0.3,
      fontSize: 9, italic: true, color: '6B7280', fontFace: 'Arial',
    });
  }
}
