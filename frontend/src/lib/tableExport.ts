/**
 * Generic client-side Excel/PDF/PPTX export for any column-described table
 * (Task 8 — "Customizable Fields, Table Column Filter & Download Options to
 * All Tables"). Mirrors lib/projectsExport.ts's approach (same three
 * libraries, same dynamic imports, same file layout) but is not tied to
 * ProjectListItem, so the Projects page keeps its own dedicated export path
 * (projectsExport.ts / ProjectsTable.tsx) completely untouched.
 */
import { useState } from 'react';

export interface ExportColumn<T> {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  exportValue: (row: T, index: number) => string | number;
}

export interface ExportMeta {
  /** Document/slide title, e.g. "BUIDCO - Sector Summary". */
  title: string;
  /** Excel worksheet name (max 31 chars, enforced by ExcelJS). */
  sheetName: string;
  /** File name prefix; a timestamp + extension are appended. */
  fileNamePrefix: string;
}

export type ExportFormat = 'excel' | 'pdf' | 'pptx';

export function timestampSuffix(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

/**
 * jsPDF's built-in fonts only cover WinAnsi/Latin-1, which has no glyph for
 * ₹ (U+20B9) — it would render as a blank/tofu box. Substitute "Rs." for the
 * PDF only; Excel keeps the real symbol since ExcelJS writes UTF-8 text.
 */
export function sanitizeForPdf(value: string | number): string | number {
  return typeof value === 'string' ? value.replace(/₹/g, 'Rs.') : value;
}

function buildExportRows<T>(columns: ExportColumn<T>[], rows: T[]): (string | number)[][] {
  return rows.map((row, index) =>
    columns.map((col) => {
      const value = col.exportValue(row, index);
      return value === null || value === undefined ? '' : value;
    }),
  );
}

function exportSubtitle(rowCount: number): string {
  return `Exported ${new Date().toLocaleString('en-IN')} - ${rowCount} row${rowCount === 1 ? '' : 's'}`;
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

export async function downloadTableExcel<T>(
  columns: ExportColumn<T>[],
  rows: T[],
  meta: ExportMeta,
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BUIDCO UDHD';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(meta.sheetName.slice(0, 31));

  sheet.columns = columns.map((col) => ({ header: col.label, key: col.key, width: 18 }));
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  const body = buildExportRows(columns, rows);
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
  triggerDownload(blob, `${meta.fileNamePrefix}_${timestampSuffix()}.xlsx`);
}

export async function downloadTablePdf<T>(
  columns: ExportColumn<T>[],
  rows: T[],
  meta: ExportMeta,
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  doc.setFontSize(12);
  doc.text(meta.title, 24, 24);
  doc.setFontSize(8);
  doc.text(exportSubtitle(rows.length), 24, 38);

  autoTable(doc, {
    startY: 48,
    head: [columns.map((c) => sanitizeForPdf(c.label))],
    body: buildExportRows(columns, rows).map((r) => r.map(sanitizeForPdf)),
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

  doc.save(`${meta.fileNamePrefix}_${timestampSuffix()}.pdf`);
}

/** Header navy used by both the PDF's headStyles.fillColor and the PPTX header row fill. */
const HEADER_FILL_HEX = '1E3A5F';

export async function downloadTablePptx<T>(
  columns: ExportColumn<T>[],
  rows: T[],
  meta: ExportMeta,
): Promise<void> {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  pptx.title = meta.title;
  pptx.layout = 'LAYOUT_WIDE';

  const slide = pptx.addSlide();
  slide.addText(meta.title, { x: 0.3, y: 0.2, w: 12.7, h: 0.4, fontSize: 16, bold: true, color: HEADER_FILL_HEX });
  slide.addText(exportSubtitle(rows.length), { x: 0.3, y: 0.58, w: 12.7, h: 0.3, fontSize: 10, color: '6B7280' });

  const halign = (c: ExportColumn<T>): 'left' | 'right' | 'center' => c.align ?? 'left';

  const headRow = columns.map((c) => ({
    text: c.label,
    options: { bold: true, color: 'FFFFFF', fill: { color: HEADER_FILL_HEX }, fontSize: 8, align: halign(c) },
  }));
  const bodyRows = buildExportRows(columns, rows).map((r) =>
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

  await pptx.writeFile({ fileName: `${meta.fileNamePrefix}_${timestampSuffix()}.pptx` });
}

/** Bundles the exporting/error UI state shared by every "⬇ Download" menu. */
export function useTableExport<T>(): {
  exporting: ExportFormat | null;
  error: string | null;
  run: (format: ExportFormat, columns: ExportColumn<T>[], rows: T[], meta: ExportMeta) => Promise<void>;
} {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (
    format: ExportFormat,
    columns: ExportColumn<T>[],
    rows: T[],
    meta: ExportMeta,
  ): Promise<void> => {
    setError(null);
    setExporting(format);
    try {
      if (format === 'excel') await downloadTableExcel(columns, rows, meta);
      else if (format === 'pdf') await downloadTablePdf(columns, rows, meta);
      else await downloadTablePptx(columns, rows, meta);
    } catch {
      setError('Export failed. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  return { exporting, error, run };
}
