/**
 * Client-side PDF/PowerPoint export for a single project's "MD Portfolio
 * Briefing" detail panel. Renders the same label/value block-card grid the
 * dashboard shows (see `ProjectDetailsBody`/`FieldRow` in
 * MdSchemeSummaryModal.tsx) — a flat grid of shaded cards, no group
 * headers — so the exported document visually matches what's on screen and
 * only includes fields ticked in the Fields picker. Both libraries are
 * dynamically imported so they're only fetched when a user actually
 * triggers a download.
 */
import { PROJECT_FIELD_GROUPS, type ProjectFieldKey } from './mdProjectFields';
import type { LookupCtx } from '../components/projects/ProjectsTable';
import { formatCurrencyCr, formatDate, formatPercent } from './formatters';
import { sanitizeForPdf, timestampSuffix } from './projectsExport';
import type { ProjectDetail, ProjectListItem } from '../types/api';

/** Card grid columns — shared by both formats so their layout stays consistent (per spec). */
const CARD_COLS = 2;

/** Mirrors the `fullWidth: true` fields in ProjectDetailsBody's renderField switch. */
const FULL_WIDTH_KEYS = new Set<ProjectFieldKey>([
  'nameOfWork',
  'issuesRemarks',
  'delayReason',
  'omRemarks',
  'projectBrief',
  'mainComponentScope',
]);

const FIELD_LABELS = Object.fromEntries(
  PROJECT_FIELD_GROUPS.flatMap((g) => g.fields.map((f) => [f.key, f.label])),
) as Record<ProjectFieldKey, string>;

/** Mirrors StatusBadge.tsx's color map. */
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'In Progress': { bg: '#DBEAFE', text: '#1D4ED8' },
  Completed: { bg: '#DCFCE7', text: '#15803D' },
  'Not Started': { bg: '#FED7AA', text: '#C2410C' },
  Delayed: { bg: '#EDE9FE', text: '#6D28D9' },
  'On Hold': { bg: '#F3F4F6', text: '#374151' },
};

/** Mirrors PriorityBadge.tsx's color map. */
const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  High: { bg: '#FEE2E2', text: '#B91C1C' },
  Medium: { bg: '#FEF3C7', text: '#B45309' },
  Low: { bg: '#DCFCE7', text: '#15803D' },
  'N/A': { bg: '#F3F4F6', text: '#6B7280' },
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function projectFileName(p: ProjectListItem): string {
  const safe = (p.projectName || p.projectId).replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 60);
  return `Project_${safe || 'Details'}_${timestampSuffix()}`;
}

/** Plain-text mirror of `renderField()` in MdSchemeSummaryModal.tsx — same data, no JSX. */
function getProjectFieldValue(
  key: ProjectFieldKey,
  p: ProjectListItem,
  asDetail: ProjectDetail | null,
  ctx: LookupCtx,
): string {
  const districtName = p.districtId ? (ctx.districtById.get(p.districtId) ?? null) : null;
  const divisionRow = p.divisionId ? (ctx.divisionById.get(p.divisionId) ?? null) : null;
  const sectorName = p.sectorId ? (ctx.sectorById.get(p.sectorId) ?? null) : null;
  const schemeNames = p.schemes.map((id) => ctx.schemeById.get(id) ?? `#${id}`);

  switch (key) {
    case 'nameOfWork': return asDetail?.mainWork ?? '—';
    case 'agreementNumber': return asDetail?.agreementNumber ?? '—';
    case 'agreementDate': return formatDate(asDetail?.agreementDate);
    case 'agreementAmount': return formatCurrencyCr(p.agreementAmountCr);
    case 'expectedCompletion': {
      const d = formatDate(p.expectedCompletionDate);
      return d === '—' ? (p.expectedCompletionRaw ?? '—') : d;
    }
    case 'physicalProgress': return formatPercent(p.effectivePhysicalPct);
    case 'financialProgress': return formatPercent(p.financialProgressPct);
    case 'expenditureTillDate': return formatCurrencyCr(p.financialProgressCr);
    case 'geotagPhotographs': return '— photos view is deferred';
    case 'issuesRemarks': return p.remark ?? '—';
    case 'agencyContractor': return p.contractor ?? '—';
    case 'pdName': return p.pd ?? '—';
    case 'city': return p.city ?? '—';
    case 'district': return districtName ?? '—';
    case 'division': return divisionRow?.name ?? '—';
    case 'region': return divisionRow?.regionName ?? '—';
    case 'sector': return sectorName ?? '—';
    case 'schemes': return schemeNames.length ? schemeNames.join(', ') : '—';
    case 'projectStageV2': return p.projectStageV2 ?? '—';
    case 'contractType': return p.contractType ?? '—';
    case 'status': return p.status ?? '—';
    case 'priority': return p.priority ?? '—';
    case 'sponsoringDept': return asDetail?.sponsoringDept ?? '—';
    case 'implementingAgency': return asDetail?.implementingAgency ?? '—';
    case 'sanctionDate': return formatDate(asDetail?.sanctionDate);
    case 'plannedEndDate': return formatDate(p.plannedEndDate);
    case 'revisedEndDate': return formatDate(p.revisedEndDate);
    case 'scheduledProgressPct': return formatPercent(asDetail?.scheduledProgressPct);
    case 'delayReason': return asDetail?.delayReason ?? '—';
    case 'deptStuckAt': return asDetail?.deptStuckAt ?? '—';
    case 'aaAmount': return formatCurrencyCr(p.aaAmountCr);
    case 'revisedAaAmount': return formatCurrencyCr(p.revisedAaAmountCr);
    case 'contractValueCr': return formatCurrencyCr(asDetail?.contractValueCr);
    case 'mobAdvanceIssuedCr': return formatCurrencyCr(asDetail?.mobAdvanceIssuedCr);
    case 'mobAdvanceRecoveredCr': return formatCurrencyCr(asDetail?.mobAdvanceRecoveredCr);
    case 'advanceOutstandingCr': return formatCurrencyCr(asDetail?.advanceOutstandingCr);
    case 'retentionMoneyHeldCr': return formatCurrencyCr(asDetail?.retentionMoneyHeldCr);
    case 'totalPaymentsCr': return formatCurrencyCr(asDetail?.totalPaymentsCr);
    case 'lastPaymentDate': return formatDate(asDetail?.lastPaymentDate);
    case 'lastRaBillNo': return asDetail?.lastRaBillNo ?? '—';
    case 'pbgNumber': return asDetail?.pbgNumber ?? '—';
    case 'pbgAmountCr': return formatCurrencyCr(asDetail?.pbgAmountCr);
    case 'pbgIssuingBank': return asDetail?.pbgIssuingBank ?? '—';
    case 'pbgExpiryDate': return formatDate(p.pbgExpiryDate);
    case 'emdAmountCr': return formatCurrencyCr(asDetail?.emdAmountCr);
    case 'emdRefNumber': return asDetail?.emdRefNumber ?? '—';
    case 'emdDate': return formatDate(asDetail?.emdDate);
    case 'omStartDate': return formatDate(p.omStartDate);
    case 'omEndDate': return formatDate(p.omEndDate);
    case 'omPeriodMonths': return p.omPeriodMonths != null ? String(p.omPeriodMonths) : '—';
    case 'omAgency': return asDetail?.omAgency ?? '—';
    case 'omRemarks': return asDetail?.omRemarks ?? '—';
    case 'projectBrief': return asDetail?.projectBrief ?? '—';
    case 'mainComponentScope': return asDetail?.mainComponentScope ?? '—';
    default: return '—';
  }
}

interface FieldCard {
  label: string;
  value: string;
  fullWidth: boolean;
}

/** Flat, ungrouped list — matches the dashboard's `visibleFields` (no section headers on screen). */
function buildFieldCards(
  visibleKeys: ProjectFieldKey[],
  p: ProjectListItem,
  asDetail: ProjectDetail | null,
  ctx: LookupCtx,
): FieldCard[] {
  return visibleKeys.map((key) => ({
    label: FIELD_LABELS[key],
    value: getProjectFieldValue(key, p, asDetail, ctx),
    fullWidth: FULL_WIDTH_KEYS.has(key),
  }));
}

interface PackedCell { card: FieldCard }

/**
 * Packs cards into rows of `cols` slots, mirroring CSS grid's default
 * (non-dense) auto-flow: a full-width card flushes the current partial row
 * (leaving any trailing slot empty) before taking its own full-span row.
 */
function packCards(cards: FieldCard[], cols: number): (PackedCell | null)[][] {
  const rows: (PackedCell | null)[][] = [];
  let current: (PackedCell | null)[] = [];
  const flush = (): void => {
    if (current.length === 0) return;
    while (current.length < cols) current.push(null);
    rows.push(current);
    current = [];
  };
  for (const card of cards) {
    if (card.fullWidth) {
      flush();
      rows.push([{ card }]); // length 1 === full-width row (cols is always >= 2 here)
      continue;
    }
    current.push({ card });
    if (current.length === cols) flush();
  }
  flush();
  return rows;
}

const PDF_MARGIN = 40;
const PDF_GUTTER = 14;
const PDF_CARD_PAD = 8;
const PDF_LABEL_SIZE = 7.5;
const PDF_VALUE_SIZE = 9.5;
const PDF_LINE_H = 12;

export async function downloadProjectPdf(
  visibleKeys: ProjectFieldKey[],
  p: ProjectListItem,
  asDetail: ProjectDetail | null,
  ctx: LookupCtx,
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const usableW = pageW - PDF_MARGIN * 2;
  const colW = (usableW - PDF_GUTTER * (CARD_COLS - 1)) / CARD_COLS;

  let y = PDF_MARGIN;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(17, 24, 39);
  const nameLines = doc.splitTextToSize(sanitizeForPdf(p.projectName || 'Project') as string, usableW);
  doc.text(nameLines, PDF_MARGIN, y + 14);
  y += nameLines.length * 18 + 6;

  const statusColor = STATUS_COLORS[p.status ?? ''] ?? STATUS_COLORS['On Hold']!;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  let pillX = PDF_MARGIN;
  const drawPill = (text: string, bgHex: string, textHex: string): void => {
    const w = doc.getTextWidth(text) + 14;
    const [br, bgc, bb] = hexToRgb(bgHex);
    const [tr, tg, tb] = hexToRgb(textHex);
    doc.setFillColor(br, bgc, bb);
    doc.roundedRect(pillX, y, w, 16, 8, 8, 'F');
    doc.setTextColor(tr, tg, tb);
    doc.text(text, pillX + 7, y + 11);
    pillX += w + 6;
  };
  drawPill((p.status ?? 'Not Started').toUpperCase(), statusColor.bg, statusColor.text);
  if (p.priority) {
    const priorityColor = PRIORITY_COLORS[p.priority] ?? PRIORITY_COLORS['N/A']!;
    drawPill(p.priority, priorityColor.bg, priorityColor.text);
  }
  y += 26;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text(`Exported ${new Date().toLocaleString('en-IN')}`, PDF_MARGIN, y);
  y += 14;

  doc.setDrawColor(229, 231, 235);
  doc.line(PDF_MARGIN, y, pageW - PDF_MARGIN, y);
  y += 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 58, 95);
  doc.text('PROJECT DETAILS', PDF_MARGIN, y);
  y += 16;

  const wrapLines = (text: string, width: number): string[] => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(PDF_VALUE_SIZE);
    return doc.splitTextToSize(sanitizeForPdf(text) as string, width - PDF_CARD_PAD * 2);
  };
  const cardHeight = (lines: string[]): number => PDF_CARD_PAD * 2 + 11 + lines.length * PDF_LINE_H;
  const ensureSpace = (h: number): void => {
    if (y + h > pageH - PDF_MARGIN) {
      doc.addPage();
      y = PDF_MARGIN;
    }
  };
  const drawCard = (card: FieldCard, x: number, width: number, cardY: number, lines: string[], boxH: number): void => {
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(x, cardY, width, boxH, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(PDF_LABEL_SIZE);
    doc.setTextColor(107, 114, 128);
    doc.text(card.label.toUpperCase(), x + PDF_CARD_PAD, cardY + PDF_CARD_PAD + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(PDF_VALUE_SIZE);
    doc.setTextColor(17, 24, 39);
    doc.text(lines, x + PDF_CARD_PAD, cardY + PDF_CARD_PAD + 20);
  };

  const cards = buildFieldCards(visibleKeys, p, asDetail, ctx);
  const rows = packCards(cards, CARD_COLS);

  for (const row of rows) {
    if (row.length === 1) {
      const cell = row[0];
      if (!cell) continue;
      const lines = wrapLines(cell.card.value, usableW);
      const h = cardHeight(lines);
      ensureSpace(h + 8);
      drawCard(cell.card, PDF_MARGIN, usableW, y, lines, h);
      y += h + 8;
      continue;
    }
    const measured = row.map((cell) => (cell ? wrapLines(cell.card.value, colW) : []));
    const rowHeight = Math.max(...measured.map(cardHeight), 0);
    ensureSpace(rowHeight + 8);
    row.forEach((cell, idx) => {
      if (!cell) return;
      const x = PDF_MARGIN + idx * (colW + PDF_GUTTER);
      drawCard(cell.card, x, colW, y, measured[idx]!, rowHeight);
    });
    y += rowHeight + 8;
  }

  doc.save(`${projectFileName(p)}.pdf`);
}

const PPTX_MARGIN = 0.4;
const PPTX_GUTTER = 0.2;
const PPTX_CARD_PAD = 0.12;
const PPTX_LABEL_PT = 8;
const PPTX_VALUE_PT = 10;
const PPTX_LINE_H = 0.16;
const SLIDE_W = 13.33;
const SLIDE_H = 7.5;
const PX_PER_IN = 96;

let measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureCtx(): CanvasRenderingContext2D {
  if (!measureCtx) {
    measureCtx = document.createElement('canvas').getContext('2d');
  }
  return measureCtx!;
}

/** Approximate word-wrap for PowerPoint cards — pptxgenjs has no text-measurement API, so this uses a canvas as a stand-in for the eventual PowerPoint font metrics. */
function canvasWrapLines(text: string, maxWidthPx: number, fontPx: number): string[] {
  const ctx = getMeasureCtx();
  ctx.font = `${fontPx}px Arial, sans-serif`;
  const words = (text || '—').split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(attempt).width > maxWidthPx) {
      lines.push(current);
      current = word;
    } else {
      current = attempt;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ['—'];
}

export async function downloadProjectPptx(
  visibleKeys: ProjectFieldKey[],
  p: ProjectListItem,
  asDetail: ProjectDetail | null,
  ctx: LookupCtx,
): Promise<void> {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  pptx.title = p.projectName || 'Project';
  pptx.layout = 'LAYOUT_WIDE';

  type Slide = ReturnType<typeof pptx.addSlide>;

  const addHeader = (s: Slide): number => {
    let yy = 0.3;
    s.addText(p.projectName || 'Project', {
      x: PPTX_MARGIN, y: yy, w: SLIDE_W - PPTX_MARGIN * 2, h: 0.4, fontSize: 18, bold: true, color: '111827',
    });
    yy += 0.44;

    const statusColor = STATUS_COLORS[p.status ?? ''] ?? STATUS_COLORS['On Hold']!;
    s.addShape('roundRect', {
      x: PPTX_MARGIN, y: yy, w: 1.2, h: 0.24, fill: { color: statusColor.bg.replace('#', '') }, line: { type: 'none' }, rectRadius: 0.06,
    });
    s.addText((p.status ?? 'Not Started').toUpperCase(), {
      x: PPTX_MARGIN, y: yy, w: 1.2, h: 0.24, fontSize: 8, bold: true, color: statusColor.text.replace('#', ''), align: 'center', valign: 'middle',
    });
    if (p.priority) {
      const priorityColor = PRIORITY_COLORS[p.priority] ?? PRIORITY_COLORS['N/A']!;
      s.addShape('roundRect', {
        x: PPTX_MARGIN + 1.3, y: yy, w: 0.9, h: 0.24, fill: { color: priorityColor.bg.replace('#', '') }, line: { type: 'none' }, rectRadius: 0.06,
      });
      s.addText(p.priority, {
        x: PPTX_MARGIN + 1.3, y: yy, w: 0.9, h: 0.24, fontSize: 8, bold: true, color: priorityColor.text.replace('#', ''), align: 'center', valign: 'middle',
      });
    }
    yy += 0.34;

    s.addText(`Exported ${new Date().toLocaleString('en-IN')}`, {
      x: PPTX_MARGIN, y: yy, w: 5, h: 0.2, fontSize: 8, color: '6B7280',
    });
    yy += 0.28;
    s.addText('PROJECT DETAILS', {
      x: PPTX_MARGIN, y: yy, w: 5, h: 0.22, fontSize: 10, bold: true, color: '1E3A5F',
    });
    return yy + 0.32;
  };

  let slide = pptx.addSlide();
  let y = addHeader(slide);

  const usableW = SLIDE_W - PPTX_MARGIN * 2;
  const colW = (usableW - PPTX_GUTTER * (CARD_COLS - 1)) / CARD_COLS;

  const measureLines = (text: string, widthIn: number): string[] =>
    canvasWrapLines(text, (widthIn - PPTX_CARD_PAD * 2) * PX_PER_IN, PPTX_VALUE_PT * (PX_PER_IN / 72));
  const cardHeight = (lines: string[]): number => PPTX_CARD_PAD * 2 + 0.16 + lines.length * PPTX_LINE_H;
  const drawCard = (s: Slide, card: FieldCard, x: number, width: number, cardY: number, lines: string[], boxH: number): void => {
    s.addShape('roundRect', {
      x, y: cardY, w: width, h: boxH, fill: { color: 'F9FAFB' }, line: { type: 'none' }, rectRadius: 0.04,
    });
    s.addText(card.label.toUpperCase(), {
      x: x + PPTX_CARD_PAD, y: cardY + PPTX_CARD_PAD - 0.03, w: width - PPTX_CARD_PAD * 2, h: 0.16, fontSize: PPTX_LABEL_PT, bold: true, color: '6B7280',
    });
    s.addText(lines.join('\n'), {
      x: x + PPTX_CARD_PAD, y: cardY + PPTX_CARD_PAD + 0.13, w: width - PPTX_CARD_PAD * 2, h: lines.length * PPTX_LINE_H, fontSize: PPTX_VALUE_PT, color: '111827',
    });
  };

  const cards = buildFieldCards(visibleKeys, p, asDetail, ctx);
  const rows = packCards(cards, CARD_COLS);

  for (const row of rows) {
    if (row.length === 1) {
      const cell = row[0];
      if (!cell) continue;
      const lines = measureLines(cell.card.value, usableW);
      const h = cardHeight(lines);
      if (y + h > SLIDE_H - PPTX_MARGIN) {
        slide = pptx.addSlide();
        y = addHeader(slide);
      }
      drawCard(slide, cell.card, PPTX_MARGIN, usableW, y, lines, h);
      y += h + 0.12;
      continue;
    }
    const measured = row.map((cell) => (cell ? measureLines(cell.card.value, colW) : []));
    const rowHeight = Math.max(...measured.map(cardHeight), 0);
    if (y + rowHeight > SLIDE_H - PPTX_MARGIN) {
      slide = pptx.addSlide();
      y = addHeader(slide);
    }
    row.forEach((cell, idx) => {
      if (!cell) return;
      const x = PPTX_MARGIN + idx * (colW + PPTX_GUTTER);
      drawCard(slide, cell.card, x, colW, y, measured[idx]!, rowHeight);
    });
    y += rowHeight + 0.12;
  }

  await pptx.writeFile({ fileName: `${projectFileName(p)}.pptx` });
}
