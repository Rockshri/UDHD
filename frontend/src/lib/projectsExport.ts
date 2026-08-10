/**
 * Client-side Excel/PDF export for the Projects table. Both libraries are
 * dynamically imported so their (fairly large) bundles are only fetched
 * when a user actually triggers a download.
 */
import type { Column, LookupCtx } from '../components/projects/ProjectsTable';
import type { ProjectListItem } from '../types/api';

export function timestampSuffix(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function buildExportRows(
  columns: Column[],
  rows: ProjectListItem[],
  ctx: LookupCtx,
): (string | number)[][] {
  return rows.map((row, index) =>
    columns.map((col) => {
      const value = col.exportValue ? col.exportValue(row, ctx, index) : '';
      return value === null || value === undefined ? '' : value;
    }),
  );
}

/**
 * jsPDF's built-in fonts only cover WinAnsi/Latin-1, which has no glyph for
 * ₹ (U+20B9) — it would render as a blank/tofu box. Substitute "Rs." for the
 * PDF only; Excel keeps the real symbol since ExcelJS writes UTF-8 text.
 */
export function sanitizeForPdf(value: string | number): string | number {
  return typeof value === 'string' ? value.replace(/₹/g, 'Rs.') : value;
}

/** Shared title/subtitle text so the PDF and PowerPoint exports stay visually consistent. */
function exportHeaderText(rows: ProjectListItem[]): { title: string; subtitle: string } {
  return {
    title: 'BUIDCO - Projects Register',
    subtitle: `Exported ${new Date().toLocaleString('en-IN')} - ${rows.length} project${rows.length === 1 ? '' : 's'}`,
  };
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadProjectsExcel(
  columns: Column[],
  rows: ProjectListItem[],
  ctx: LookupCtx,
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BUIDCO UDHD';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Projects');

  sheet.columns = columns.map((col) => ({
    header: col.label,
    key: col.key,
    width: Math.max(12, Math.min(40, Math.round((col.minWidth ?? 120) / 7))),
  }));
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  const body = buildExportRows(columns, rows, ctx);
  for (const rowValues of body) {
    const rowObj: Record<string, string | number> = {};
    columns.forEach((col, i) => {
      rowObj[col.key] = rowValues[i] ?? '';
    });
    const excelRow = sheet.addRow(rowObj);
    columns.forEach((col, i) => {
      if (col.align === 'right' || col.align === 'center') {
        excelRow.getCell(i + 1).alignment = { horizontal: col.align };
      }
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, `Projects_Export_${timestampSuffix()}.xlsx`);
}

export async function downloadProjectsPdf(
  columns: Column[],
  rows: ProjectListItem[],
  ctx: LookupCtx,
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const { title, subtitle } = exportHeaderText(rows);

  doc.setFontSize(12);
  doc.text(title, 24, 24);
  doc.setFontSize(8);
  doc.text(subtitle, 24, 38);

  autoTable(doc, {
    startY: 48,
    head: [columns.map((c) => sanitizeForPdf(c.label))],
    body: buildExportRows(columns, rows, ctx).map((r) => r.map(sanitizeForPdf)),
    styles: { fontSize: 6.5, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold' },
    columnStyles: Object.fromEntries(
      columns.map((c, i) => [
        i,
        { halign: c.align === 'right' ? 'right' : c.align === 'center' ? 'center' : 'left' },
      ]),
    ),
    margin: { left: 24, right: 24 },
  });

  doc.save(`Projects_Export_${timestampSuffix()}.pdf`);
}

/** Header navy used by both the PDF's headStyles.fillColor and the PPTX header row fill. */
const HEADER_FILL_HEX = '1E3A5F';

export async function downloadProjectsPptx(
  columns: Column[],
  rows: ProjectListItem[],
  ctx: LookupCtx,
): Promise<void> {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  pptx.title = 'BUIDCO - Projects Register';
  pptx.layout = 'LAYOUT_WIDE';

  const slide = pptx.addSlide();
  const { title, subtitle } = exportHeaderText(rows);
  slide.addText(title, { x: 0.3, y: 0.2, w: 12.7, h: 0.4, fontSize: 16, bold: true, color: HEADER_FILL_HEX });
  slide.addText(subtitle, { x: 0.3, y: 0.58, w: 12.7, h: 0.3, fontSize: 10, color: '6B7280' });

  const halign = (c: Column): 'left' | 'right' | 'center' => c.align ?? 'left';

  const headRow = columns.map((c) => ({
    text: c.label,
    options: { bold: true, color: 'FFFFFF', fill: { color: HEADER_FILL_HEX }, fontSize: 8, align: halign(c) },
  }));
  const bodyRows = buildExportRows(columns, rows, ctx).map((r) =>
    r.map((value, i) => ({
      text: String(value),
      options: { fontSize: 7, align: halign(columns[i]!) },
    })),
  );

  slide.addTable([headRow, ...bodyRows], {
    x: 0.3,
    y: 1.0,
    w: 12.7,
    autoPage: true,
    autoPageRepeatHeader: true,
    autoPageHeaderRows: 1,
    border: { type: 'solid', color: 'E5E7EB', pt: 0.5 },
    fontSize: 7,
  });

  await pptx.writeFile({ fileName: `Projects_Export_${timestampSuffix()}.pptx` });
}
