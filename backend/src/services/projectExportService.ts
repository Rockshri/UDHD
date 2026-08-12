/**
 * Project export service — Excel / PDF / PPTX.
 *
 * The Excel output round-trips against the import template
 * (`1 BUIDCO_Input_Sheet_Fillable.xlsx`): identical sheet names, section
 * merges + colors, column widths, freeze pane, dropdowns, auto-formulas.
 * Users can export → edit → re-import without any format-massaging.
 *
 * PDF + PPTX are summary-focused, following the same pattern as the
 * MD Portfolio Briefing export.
 */

import ExcelJS, { type CellValue } from 'exceljs';
import PDFDocument from 'pdfkit';
// pptxgenjs's default export IS the constructor at runtime, but its .d.ts
// combines `export default` (class) with `export as namespace` — confuses
// tsc. Cast to a plain constructor sig — verified working at runtime.
import PptxGenJSDefault from 'pptxgenjs';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PptxGenJS = PptxGenJSDefault as unknown as new () => any;

import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  cosEotItem, division, geoPhoto, managementActionItem,
  project, projectScheme, region, scheme, sector,
} from '../db/schema.js';
import type { AuditActor } from '../lib/audit.js';
import {
  AUTO_CELL_FILL, AUTO_COL_NUMFMT, AUTO_FORMULAS, BORDER_ARGB, COLUMN_WIDTHS,
  CONTRACT_TYPE_DB_TO_TEMPLATE, COS_EOT_SHEET, DATA_CELL_FILL, DATE_NUMFMT,
  DIVISION_REGION_PAIRS, EXEC_STATUS_DB_TO_TEMPLATE, FREEZE_X_SPLIT, FREEZE_Y_SPLIT,
  GEO_PHOTOS_SHEET, HEADER_TEXT_ARGB, HEADER_TINT_FILL, LIST_VALUES, LISTS_SHEET,
  MGMT_ACTIONS_SHEET, NUMBER_NUMFMT, PROJECT_REGISTER_COLUMNS, PROJECT_REGISTER_SHEET,
  PROJECT_STAGE_DB_TO_TEMPLATE, ROW_HEIGHTS, ROW_NUMBER_HEADER_FILL, SECTION_FILL,
  SECTIONS, SHARED_FORMULA_COLUMNS, SHARED_FORMULA_END_ROW, SUBSHEET_HEADERS,
  TYPE_HINT_TEXT_ARGB, type ColumnDef, type FillPair, type SectionLabel,
} from '../lib/importTemplate.js';

// ─── Public API ──────────────────────────────────────────────────────────

export interface ExportFilters {
  search?: string;
  status?: string;
  projectStage?: string;
  contractType?: string;
  sectorId?: number;
  divisionId?: number;
  regionId?: number;
  schemeId?: number;
  /** Explicit project ID whitelist (from multi-select). Overrides filters. */
  projectIds?: string[];
}

/** Export the given filtered slice as an XLSX that matches the import template. */
export async function exportProjectsToXlsx(
  filters: ExportFilters,
  actor: AuditActor,
  pdDivisionId: number | null,
): Promise<Buffer> {
  void actor; // audit hook can be added at the route layer if desired
  const data = await queryExportData(filters, pdDivisionId);
  const wb = createTemplateWorkbook();
  const registerSheet = wb.getWorksheet(PROJECT_REGISTER_SHEET)!;
  writeProjectRows(registerSheet, data);
  writeCosEotRows(wb.getWorksheet(COS_EOT_SHEET)!, data);
  writeMgmtRows(wb.getWorksheet(MGMT_ACTIONS_SHEET)!, data);
  writeGeoPhotoRows(wb.getWorksheet(GEO_PHOTOS_SHEET)!, data);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** Blank template — no data rows, just headers + pre-styled empty rows + dropdowns. */
export async function generateBlankTemplateXlsx(): Promise<Buffer> {
  const wb = createTemplateWorkbook();
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** Basic PDF: landscape table of the exported projects. */
export async function exportProjectsToPdf(
  filters: ExportFilters,
  actor: AuditActor,
  pdDivisionId: number | null,
): Promise<Buffer> {
  void actor;
  const data = await queryExportData(filters, pdDivisionId);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4', layout: 'landscape', margin: 32,
      info: { Title: 'BUIDCO Projects', Creator: 'BUIDCO Dashboard' },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    drawProjectsPdf(doc, data);
    doc.end();
  });
}

/** Basic PPTX: cover slide + one project-list slide (up to 20 rows). */
export async function exportProjectsToPptx(
  filters: ExportFilters,
  actor: AuditActor,
  pdDivisionId: number | null,
): Promise<Buffer> {
  void actor;
  const data = await queryExportData(filters, pdDivisionId);
  const pptx = new PptxGenJS();
  pptx.author = 'BUIDCO Dashboard';
  pptx.title = 'BUIDCO Projects';
  pptx.layout = 'LAYOUT_WIDE';
  drawProjectsPptx(pptx, data);
  const blob = await pptx.write({ outputType: 'nodebuffer' });
  return blob as Buffer;
}

// ─── Data fetch ──────────────────────────────────────────────────────────

interface ExportData {
  projects: Array<Record<string, unknown>>;
  /** projectId → schemes[] (name strings). */
  schemesByProject: Map<string, string[]>;
  /** projectId → CoS/EoT rows. */
  cosByProject: Map<string, Array<Record<string, unknown>>>;
  /** projectId → Mgmt Action rows. */
  mgmtByProject: Map<string, Array<Record<string, unknown>>>;
  /** projectId → GeoPhoto rows. */
  geoByProject: Map<string, Array<Record<string, unknown>>>;
  /** Lookup tables so we can render Sector / Division names in the sheet. */
  sectorNameById: Map<number, string>;
  divisionNameById: Map<number, string>;
  regionNameByDivisionId: Map<number, string>;
}

async function queryExportData(f: ExportFilters, pdDivisionId: number | null): Promise<ExportData> {
  // Assemble WHERE clauses.
  const where: ReturnType<typeof eq>[] = [];
  if (f.projectIds && f.projectIds.length > 0) where.push(inArray(project.projectId, f.projectIds));
  if (f.status) where.push(eq(project.status, f.status));
  if (f.projectStage) where.push(eq(project.projectStageV2, f.projectStage));
  if (f.contractType) where.push(eq(project.contractType, f.contractType));
  if (f.sectorId) where.push(eq(project.sectorId, f.sectorId));
  if (f.divisionId) where.push(eq(project.divisionId, f.divisionId));
  if (pdDivisionId !== null) where.push(eq(project.divisionId, pdDivisionId));
  // Note: search + regionId + schemeId aren't first-class project columns; we
  // filter those below (post-load).

  const rows = where.length > 0
    ? await db.select().from(project).where(and(...where))
    : await db.select().from(project);

  // Search substring across project_name + project_id.
  let filtered = rows;
  if (f.search) {
    const q = f.search.toLowerCase();
    filtered = filtered.filter((r) =>
      String(r.projectName ?? '').toLowerCase().includes(q) ||
      String(r.projectId ?? '').toLowerCase().includes(q),
    );
  }

  const projectIds = filtered.map((r) => r.projectId);

  // Fetch lookups + child data in parallel.
  const [sectors, divisions, regions, allSchemes, cosRows, mgmtRows, geoRows, psRows] = await Promise.all([
    db.select().from(sector),
    db.select().from(division),
    db.select().from(region),
    db.select().from(scheme),
    projectIds.length > 0
      ? db.select().from(cosEotItem).where(inArray(cosEotItem.projectId, projectIds))
      : Promise.resolve([]),
    projectIds.length > 0
      ? db.select().from(managementActionItem).where(inArray(managementActionItem.projectId, projectIds))
      : Promise.resolve([]),
    projectIds.length > 0
      ? db.select().from(geoPhoto).where(inArray(geoPhoto.projectId, projectIds))
      : Promise.resolve([]),
    projectIds.length > 0
      ? db.select().from(projectScheme).where(inArray(projectScheme.projectId, projectIds))
      : Promise.resolve([]),
  ]);

  const sectorNameById = new Map(sectors.map((s) => [s.sectorId, s.sectorName]));
  const divisionNameById = new Map(divisions.map((d) => [d.divisionId, d.divisionName]));
  const regionNameById = new Map(regions.map((r) => [r.regionId, r.regionName]));
  const schemeNameById = new Map(allSchemes.map((s) => [s.schemeId, s.schemeName]));
  const regionNameByDivisionId = new Map(
    divisions.map((d) => [d.divisionId, regionNameById.get(d.regionId) ?? '']),
  );

  const schemesByProject = new Map<string, string[]>();
  for (const ps of psRows) {
    const list = schemesByProject.get(ps.projectId) ?? [];
    const name = schemeNameById.get(ps.schemeId);
    if (name) list.push(name);
    schemesByProject.set(ps.projectId, list);
  }

  // Apply schemeId + regionId post-filters (these need the join tables above).
  if (f.schemeId !== undefined) {
    const wantScheme = schemeNameById.get(f.schemeId);
    if (wantScheme) {
      filtered = filtered.filter((r) => (schemesByProject.get(r.projectId) ?? []).includes(wantScheme));
    }
  }
  if (f.regionId !== undefined) {
    filtered = filtered.filter((r) => {
      const d = divisions.find((x) => x.divisionId === r.divisionId);
      return d?.regionId === f.regionId;
    });
  }

  const groupBy = <T extends { projectId: string }>(rows: T[]): Map<string, T[]> => {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      const list = m.get(r.projectId) ?? [];
      list.push(r);
      m.set(r.projectId, list);
    }
    return m;
  };

  return {
    projects: filtered,
    schemesByProject,
    cosByProject: groupBy(cosRows),
    mgmtByProject: groupBy(mgmtRows),
    geoByProject: groupBy(geoRows),
    sectorNameById,
    divisionNameById,
    regionNameByDivisionId,
  };
}

// ─── XLSX: workbook shell ────────────────────────────────────────────────

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top:    { style: 'thin', color: { argb: BORDER_ARGB } },
  bottom: { style: 'thin', color: { argb: BORDER_ARGB } },
  left:   { style: 'thin', color: { argb: BORDER_ARGB } },
  right:  { style: 'thin', color: { argb: BORDER_ARGB } },
};

function solidFill(pair: FillPair): ExcelJS.Fill {
  return {
    type: 'pattern', pattern: 'solid',
    fgColor: { argb: pair.fg },
    bgColor: { argb: pair.bg },
  };
}

/** Reference workbook has 150 pre-styled empty data rows for polish. */
const PRESTYLE_ROW_COUNT = 150;

function createTemplateWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BUIDCO Dashboard';
  wb.created = new Date();

  // Sheet order matches reference: Project Register, GeoTagging, CoS-EoT, Mgmt, Lists.
  const registerSheet = wb.addWorksheet(PROJECT_REGISTER_SHEET, {
    views: [{
      state: 'frozen',
      xSplit: FREEZE_X_SPLIT, ySplit: FREEZE_Y_SPLIT,
      showGridLines: false,
    }],
  });
  applyColumnWidths(registerSheet);
  writeProjectHeaderRows(registerSheet);
  preStyleProjectDataRows(registerSheet, PRESTYLE_ROW_COUNT);
  attachDropdownValidations(registerSheet);

  writeChildSheet(wb, GEO_PHOTOS_SHEET);
  writeChildSheet(wb, COS_EOT_SHEET);
  writeChildSheet(wb, MGMT_ACTIONS_SHEET);
  writeListsSheet(wb);

  return wb;
}

function applyColumnWidths(sheet: ExcelJS.Worksheet): void {
  for (const col of PROJECT_REGISTER_COLUMNS) {
    const w = COLUMN_WIDTHS[col.index];
    if (w) sheet.getColumn(col.index).width = w;
  }
}

// ─── XLSX: Project Register header rows (r1..r3) ─────────────────────────

function writeProjectHeaderRows(sheet: ExcelJS.Worksheet): void {
  for (const col of PROJECT_REGISTER_COLUMNS) {
    sheet.getCell(1, col.index).value = col.section ?? (col.index === 1 ? '#' : '');
    sheet.getCell(2, col.index).value = col.header;
    sheet.getCell(3, col.index).value = typeHintText(col);
  }
  sheet.getRow(1).height = ROW_HEIGHTS.SECTION_HEADER;
  sheet.getRow(2).height = ROW_HEIGHTS.COLUMN_HEADER;
  sheet.getRow(3).height = ROW_HEIGHTS.TYPE_HINT;

  applySectionHeaderStyles(sheet);

  // Row 2 — column headers. Row-number col (A) skips border/alignment.
  for (let c = 1; c <= PROJECT_REGISTER_COLUMNS.length; c++) {
    const cell = sheet.getCell(2, c);
    cell.font = { name: 'Arial', family: 2, size: 9, bold: true, color: { argb: HEADER_TEXT_ARGB } };
    cell.fill = solidFill(HEADER_TINT_FILL);
    if (c !== 1) {
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = THIN_BORDER;
    }
  }
  // Row 3 — type hints. Row-number col uses Excel default font, no styling.
  for (let c = 1; c <= PROJECT_REGISTER_COLUMNS.length; c++) {
    const cell = sheet.getCell(3, c);
    cell.fill = solidFill(HEADER_TINT_FILL);
    if (c !== 1) {
      cell.font = { name: 'Arial', family: 2, size: 8, italic: true, color: { argb: TYPE_HINT_TEXT_ARGB } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = THIN_BORDER;
    }
  }
}

function typeHintText(col: ColumnDef): string | null {
  if (col.index === 1) return null;
  if (col.dataType === 'Dropdown' && col.dropdown) return `Dropdown: ${col.dropdown}`;
  if (col.dataType === 'Auto') return 'Auto (formula)';
  return col.dataType;
}

function applySectionHeaderStyles(sheet: ExcelJS.Worksheet): void {
  // A1 — leading '#' cell.
  const a1 = sheet.getCell(1, 1);
  a1.font = { name: 'Arial', family: 2, size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
  a1.fill = solidFill(ROW_NUMBER_HEADER_FILL);

  // Group contiguous columns by section for the merge ranges.
  const ranges: Array<{ section: SectionLabel; start: number; end: number }> = [];
  let current: { section: SectionLabel; start: number; end: number } | null = null;
  for (const col of PROJECT_REGISTER_COLUMNS) {
    if (col.section === null) {
      if (current) { ranges.push(current); current = null; }
      continue;
    }
    if (current && current.section === col.section && col.index === current.end + 1) {
      current.end = col.index;
    } else {
      if (current) ranges.push(current);
      current = { section: col.section, start: col.index, end: col.index };
    }
  }
  if (current) ranges.push(current);

  for (const range of ranges) {
    if (range.end > range.start) sheet.mergeCells(1, range.start, 1, range.end);
    const cell = sheet.getCell(1, range.start);
    cell.value = range.section;
    cell.font = { name: 'Arial', family: 2, size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = solidFill(SECTION_FILL[range.section]);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = THIN_BORDER;
  }
}

// ─── XLSX: Project Register data rows ────────────────────────────────────

/** Pre-style N empty data rows so the blank template + short exports look polished. */
function preStyleProjectDataRows(sheet: ExcelJS.Worksheet, n: number): void {
  for (let i = 0; i < n; i++) {
    const excelRow = i + 4;
    sheet.getRow(excelRow).height = ROW_HEIGHTS.DATA;
    for (const col of PROJECT_REGISTER_COLUMNS) {
      const cell = sheet.getCell(excelRow, col.index);
      cell.font = { name: 'Arial', family: 2, size: 10 };
      cell.border = THIN_BORDER;
      if (col.index === 1) {
        cell.value = { formula: String(i + 1), result: i + 1 };
        cell.alignment = { horizontal: 'center' };
        continue;
      }
      const formulaFactory = AUTO_FORMULAS[col.index];
      if (formulaFactory) {
        cell.value = buildFormulaValue(col.index, excelRow, formulaFactory);
        cell.fill = solidFill(AUTO_CELL_FILL);
      } else {
        cell.fill = solidFill(DATA_CELL_FILL);
      }
      if (col.dataType === 'Date') cell.numFmt = DATE_NUMFMT;
      if (col.dataType === 'Number') cell.numFmt = NUMBER_NUMFMT;
      const autoFmt = AUTO_COL_NUMFMT[col.index];
      if (autoFmt) cell.numFmt = autoFmt;
    }
  }
}

function buildFormulaValue(
  colIndex: number, excelRow: number,
  factory: (r: number) => string,
): ExcelJS.CellValue {
  if (!SHARED_FORMULA_COLUMNS.has(colIndex)) {
    return { formula: factory(excelRow) } as ExcelJS.CellFormulaValue;
  }
  const col = PROJECT_REGISTER_COLUMNS.find((c) => c.index === colIndex)!;
  if (excelRow === 4) {
    return {
      formula: factory(4),
      ref: `${col.letter}4:${col.letter}${SHARED_FORMULA_END_ROW}`,
      shareType: 'shared',
    } as unknown as ExcelJS.CellValue;
  }
  if (excelRow <= SHARED_FORMULA_END_ROW) {
    return { sharedFormula: `${col.letter}4` } as unknown as ExcelJS.CellValue;
  }
  return { formula: factory(excelRow) } as ExcelJS.CellFormulaValue;
}

/** Overlay actual project data on top of the pre-styled empty rows. */
function writeProjectRows(sheet: ExcelJS.Worksheet, data: ExportData): void {
  const {
    projects, sectorNameById, divisionNameById, schemesByProject,
  } = data;
  for (let i = 0; i < projects.length; i++) {
    const p = projects[i]!;
    const row = i + 4;
    // If we go past the pre-styled rows, style each new cell inline.
    const isPreStyled = i < PRESTYLE_ROW_COUNT;
    if (!isPreStyled) sheet.getRow(row).height = ROW_HEIGHTS.DATA;
    for (const col of PROJECT_REGISTER_COLUMNS) {
      const cell = sheet.getCell(row, col.index);
      if (!isPreStyled) styleDataCell(cell, col, row);
      if (col.index === 1) {
        cell.value = i + 1; // override formula with plain int for real rows
        continue;
      }
      // Auto columns are formula-driven; don't overwrite (formula was pre-set).
      if (col.dataType === 'Auto') continue;
      const raw = extractCellValue(p, col, sectorNameById, divisionNameById, schemesByProject);
      if (raw !== undefined) cell.value = raw as CellValue;
    }
  }
}

function styleDataCell(cell: ExcelJS.Cell, col: ColumnDef, excelRow: number): void {
  cell.font = { name: 'Arial', family: 2, size: 10 };
  cell.border = THIN_BORDER;
  if (col.index === 1) {
    cell.alignment = { horizontal: 'center' };
    return;
  }
  const formulaFactory = AUTO_FORMULAS[col.index];
  if (formulaFactory) {
    cell.value = buildFormulaValue(col.index, excelRow, formulaFactory);
    cell.fill = solidFill(AUTO_CELL_FILL);
  } else {
    cell.fill = solidFill(DATA_CELL_FILL);
  }
  if (col.dataType === 'Date') cell.numFmt = DATE_NUMFMT;
  if (col.dataType === 'Number') cell.numFmt = NUMBER_NUMFMT;
  const autoFmt = AUTO_COL_NUMFMT[col.index];
  if (autoFmt) cell.numFmt = autoFmt;
}

/**
 * Extract the display value for a project row + column, applying enum
 * normalization + FK lookups + template-specific transforms.
 * Returns `undefined` for cells that should stay blank (Auto columns
 * are handled by formulas; the extractor doesn't produce them).
 */
function extractCellValue(
  p: Record<string, unknown>, col: ColumnDef,
  sectorNames: Map<number, string>, divisionNames: Map<number, string>,
  schemesByProject: Map<string, string[]>,
): unknown {
  if (!col.dbField) return undefined;
  const raw = p[col.dbField];
  if (raw === null || raw === undefined) return null;

  // Special cases first
  switch (col.dbField) {
    case 'sectorId':
      return typeof raw === 'number' ? sectorNames.get(raw) ?? null : null;
    case 'divisionId':
      return typeof raw === 'number' ? divisionNames.get(raw) ?? null : null;
    case 'schemes': {
      const pid = String(p.projectId ?? '');
      const names = schemesByProject.get(pid) ?? [];
      return names.length > 0 ? names.join(', ') : null;
    }
    case 'contractType':
      return CONTRACT_TYPE_DB_TO_TEMPLATE[String(raw)] ?? raw;
    case 'projectStageV2':
      return PROJECT_STAGE_DB_TO_TEMPLATE[String(raw)] ?? raw;
    case 'status':
      return EXEC_STATUS_DB_TO_TEMPLATE[String(raw)] ?? raw;
    case 'omApplicable':
      return raw === true ? 'Yes' : raw === false ? 'No' : null;
  }

  // Numeric fields on `project` come back from drizzle as strings (numeric
  // columns are string-typed to avoid IEEE-754 loss). Coerce to number
  // for xlsx so the numFmt renders correctly.
  if (col.dataType === 'Number' && typeof raw === 'string') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  // Dates come back as `Date | string`; xlsx handles both.
  return raw;
}

// ─── XLSX: Lists sheet ───────────────────────────────────────────────────

function writeListsSheet(wb: ExcelJS.Workbook): void {
  const sheet = wb.addWorksheet(LISTS_SHEET);
  const listNames = Object.keys(LIST_VALUES) as Array<keyof typeof LIST_VALUES>;

  for (let i = 0; i < listNames.length; i++) {
    sheet.getCell(1, i + 1).value = String(listNames[i]);
  }
  sheet.getRow(1).font = { bold: true };
  for (let c = 0; c < listNames.length; c++) {
    const name = listNames[c]!;
    const values = LIST_VALUES[name];
    for (let r = 0; r < values.length; r++) {
      sheet.getCell(r + 2, c + 1).value = values[r] as string;
    }
    sheet.getColumn(c + 1).width = Math.max(14, Math.min(28, name.length + 4));
  }

  // Cols N/O — Division → Region lookup for the Region VLOOKUP formula.
  sheet.getCell(1, 14).value = 'Division';
  sheet.getCell(1, 15).value = 'Region';
  for (let i = 0; i < DIVISION_REGION_PAIRS.length; i++) {
    const pair = DIVISION_REGION_PAIRS[i]!;
    sheet.getCell(i + 2, 14).value = pair[0];
    sheet.getCell(i + 2, 15).value = pair[1];
  }
  sheet.getColumn(14).width = 22;
  sheet.getColumn(15).width = 14;
}

function attachDropdownValidations(sheet: ExcelJS.Worksheet): void {
  // Column letters A-L for the 12 dropdown lists in the Lists sheet.
  const listCols: Record<string, string> = {
    Sector: 'A', Division: 'B', ContractType: 'C', ProjectStage: 'D',
    ExecStatusCode: 'E', ExecStatusLabel: 'F', YesNo: 'G', Priority: 'H',
    OMStatus: 'I', CoSCategory: 'J', MgmtStatus: 'K', Scheme: 'L',
  };
  for (const col of PROJECT_REGISTER_COLUMNS) {
    if (col.dataType !== 'Dropdown' || !col.dropdown) continue;
    const listCol = listCols[col.dropdown];
    if (!listCol) continue;
    const listLen = LIST_VALUES[col.dropdown].length;
    const formulae = [`=${LISTS_SHEET}!$${listCol}$2:$${listCol}$${1 + listLen}`];
    for (let r = 4; r < 4 + PRESTYLE_ROW_COUNT; r++) {
      sheet.getCell(r, col.index).dataValidation = {
        type: 'list', allowBlank: true, formulae,
        showErrorMessage: true, errorTitle: 'Invalid value',
        error: `Choose a value from the ${col.dropdown} list.`,
      };
    }
  }
}

// ─── XLSX: child sheets ──────────────────────────────────────────────────

type ChildSheetName = keyof typeof SUBSHEET_HEADERS;

function writeChildSheet(wb: ExcelJS.Workbook, sheetName: ChildSheetName): void {
  const s = wb.addWorksheet(sheetName);
  const headers = SUBSHEET_HEADERS[sheetName];
  for (let i = 0; i < headers.length; i++) {
    const cell = s.getCell(1, i + 1);
    cell.value = headers[i] ?? '';
    cell.font = { name: 'Arial', family: 2, size: 9, bold: true, color: { argb: HEADER_TEXT_ARGB } };
    cell.fill = solidFill(HEADER_TINT_FILL);
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = THIN_BORDER;
    s.getColumn(i + 1).width = 22;
  }
  s.getRow(1).height = ROW_HEIGHTS.COLUMN_HEADER;
  s.views = [{ state: 'frozen', ySplit: 1 }];
}

function writeCosEotRows(sheet: ExcelJS.Worksheet, data: ExportData): void {
  let row = 2;
  for (const p of data.projects) {
    const items = data.cosByProject.get(String(p.projectId ?? ''));
    if (!items) continue;
    for (const it of items) {
      writeRow(sheet, row++, [
        p.projectName ?? '',
        it.cosNumber ?? '',
        it.cosDate ?? '',
        it.category ?? '',
        toNumberOrEmpty(it.cosAmountCr),
        toNumberOrEmpty(it.variationPct),
        it.eotNumber ?? '',
        toNumberOrEmpty(it.eotDaysGranted),
        it.timeLinked === true ? 'Yes' : it.timeLinked === false ? 'No' : '',
        it.originalEndDate ?? '',
        it.newEndDate ?? '',
        it.revisedDate ?? '',
      ]);
    }
  }
}

function writeMgmtRows(sheet: ExcelJS.Worksheet, data: ExportData): void {
  let row = 2;
  for (const p of data.projects) {
    const items = data.mgmtByProject.get(String(p.projectId ?? ''));
    if (!items) continue;
    for (const it of items) {
      writeRow(sheet, row++, [
        p.projectName ?? '',
        it.topic ?? '',
        it.status ?? '',
        it.deadlineDate ?? '',
      ]);
    }
  }
}

function writeGeoPhotoRows(sheet: ExcelJS.Worksheet, data: ExportData): void {
  let row = 2;
  for (const p of data.projects) {
    const items = data.geoByProject.get(String(p.projectId ?? ''));
    if (!items) continue;
    for (const it of items) {
      writeRow(sheet, row++, [
        p.projectName ?? '',
        it.url ?? '',
        it.caption ?? '',
        it.photoDate ?? '',
      ]);
    }
  }
}

function writeRow(sheet: ExcelJS.Worksheet, row: number, cells: unknown[]): void {
  for (let c = 0; c < cells.length; c++) {
    const cell = sheet.getCell(row, c + 1);
    cell.value = cells[c] as CellValue;
    cell.font = { name: 'Arial', family: 2, size: 10 };
    cell.border = THIN_BORDER;
    if (cells[c] instanceof Date) cell.numFmt = DATE_NUMFMT;
    if (typeof cells[c] === 'number') cell.numFmt = NUMBER_NUMFMT;
  }
}

function toNumberOrEmpty(v: unknown): number | '' {
  if (v === null || v === undefined || v === '') return '';
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : '';
}

// ─── PDF ─────────────────────────────────────────────────────────────────

function drawProjectsPdf(doc: PDFKit.PDFDocument, data: ExportData): void {
  doc.fillColor('#1E3A5F').fontSize(16).font('Helvetica-Bold')
    .text('BUIDCO Projects', { align: 'center' });
  doc.fillColor('#6B7280').fontSize(9).font('Helvetica-Oblique')
    .text(`Total: ${data.projects.length} projects · Generated ${new Date().toLocaleDateString('en-IN')}`, { align: 'center' });
  doc.moveDown(0.5);

  const headers = ['#', 'Project Name', 'Sector', 'Division', 'Contract', 'Stage', 'Status', 'AA (Cr)', 'Agr. (Cr)', 'Spent (Cr)', 'Phys %', 'Fin %'];
  const widths  = [24, 190, 65, 85, 75, 65, 55, 55, 55, 55, 40, 40];
  const rowH = 16;
  const x0 = doc.page.margins.left;
  let y = doc.y;
  drawPdfRow(doc, headers, widths, x0, y, rowH, true);
  y += rowH;

  const projects = data.projects;
  for (let i = 0; i < projects.length; i++) {
    if (y > doc.page.height - doc.page.margins.bottom - rowH) {
      doc.addPage();
      y = doc.page.margins.top;
      drawPdfRow(doc, headers, widths, x0, y, rowH, true);
      y += rowH;
    }
    const p = projects[i]!;
    const sector = typeof p.sectorId === 'number' ? data.sectorNameById.get(p.sectorId) ?? '' : '';
    const divisionName = typeof p.divisionId === 'number' ? data.divisionNameById.get(p.divisionId) ?? '' : '';
    drawPdfRow(doc, [
      String(i + 1),
      String(p.projectName ?? ''),
      sector,
      divisionName,
      String(p.contractType ?? ''),
      String(p.projectStageV2 ?? ''),
      String(p.status ?? ''),
      fmtNum(p.aaAmountCr),
      fmtNum(p.agreementAmountCr),
      fmtNum(p.financialProgressCr),
      fmtPct(p.physicalProgressPct),
      fmtPct(p.financialProgressPct),
    ], widths, x0, y, rowH, false);
    y += rowH;
  }
  doc.y = y;
}

function drawPdfRow(
  doc: PDFKit.PDFDocument, cells: string[], widths: number[],
  x0: number, y: number, h: number, header: boolean,
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

function fmtNum(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n.toFixed(2) : '';
}
function fmtPct(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n.toFixed(1) : '';
}

// ─── PPTX ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawProjectsPptx(pptx: any, data: ExportData): void {
  // Cover
  const cover = pptx.addSlide();
  cover.background = { color: '1E3A5F' };
  cover.addText('BUIDCO Projects', {
    x: 0.5, y: 2.0, w: 12, h: 1.2,
    fontSize: 40, bold: true, color: 'FFFFFF', align: 'center', fontFace: 'Arial',
  });
  cover.addText(`${data.projects.length} projects`, {
    x: 0.5, y: 3.3, w: 12, h: 0.6,
    fontSize: 18, color: 'BFDBFE', align: 'center', italic: true, fontFace: 'Arial',
  });
  cover.addText(`Generated ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, {
    x: 0.5, y: 6.5, w: 12, h: 0.4,
    fontSize: 12, color: '93C5FD', align: 'center', fontFace: 'Arial',
  });

  // Projects slide (cap at 20 rows to keep it readable)
  const cap = Math.min(data.projects.length, 20);
  const list = pptx.addSlide();
  list.addText(`Projects (showing ${cap} of ${data.projects.length})`, {
    x: 0.5, y: 0.3, w: 12, h: 0.6,
    fontSize: 20, bold: true, color: '1E3A5F', fontFace: 'Arial',
  });

  const headers = ['#', 'Project Name', 'Sector', 'Division', 'Stage', 'Status', 'AA (Cr)', 'Fin %'];
  const headerCells = headers.map((h) => ({
    text: h,
    options: { bold: true, color: 'FFFFFF', fill: { color: '1E3A5F' }, fontSize: 10, fontFace: 'Arial' },
  }));
  const bodyRows = data.projects.slice(0, cap).map((p, i) => [
    { text: String(i + 1) },
    { text: String(p.projectName ?? '') },
    { text: typeof p.sectorId === 'number' ? data.sectorNameById.get(p.sectorId) ?? '' : '' },
    { text: typeof p.divisionId === 'number' ? data.divisionNameById.get(p.divisionId) ?? '' : '' },
    { text: String(p.projectStageV2 ?? '') },
    { text: String(p.status ?? '') },
    { text: fmtNum(p.aaAmountCr) },
    { text: fmtPct(p.financialProgressPct) },
  ]);
  list.addTable([headerCells, ...bodyRows], {
    x: 0.4, y: 1.0, w: 12.5, h: 6.0,
    colW: [0.5, 3.8, 1.5, 2.0, 1.5, 1.4, 0.9, 0.9],
    fontSize: 9, fontFace: 'Arial',
    border: { pt: 0.5, color: 'D1D5DB' },
  });
  if (data.projects.length > cap) {
    list.addText(`(${data.projects.length - cap} more projects — see Excel export for the full list)`, {
      x: 0.4, y: 7.1, w: 12.5, h: 0.3,
      fontSize: 9, italic: true, color: '6B7280', fontFace: 'Arial',
    });
  }
}
