/**
 * Project import service — parses an uploaded XLSX (matching the
 * `1 BUIDCO_Input_Sheet_Fillable.xlsx` template), validates each row,
 * and either previews the outcome or commits the valid rows through
 * the same `createProject` path the API uses.
 *
 * Validation is per-row: bad rows are reported with row number + field
 * error; good rows are still processed. Only valid rows land in the DB.
 *
 * Child sheets (CoS-EoT Log, Management Actions Log, GeoTagging Photos
 * Log) are parsed but attached AFTER the parent project inserts so the
 * foreign-key references resolve. Rows referencing a non-existent
 * Project Name are surfaced as errors.
 */

import ExcelJS from 'exceljs';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  cosEotItem, division, geoPhoto, managementActionItem, project,
  scheme, sector,
} from '../db/schema.js';
import type { AuditActor } from '../lib/audit.js';
import {
  COS_EOT_SHEET, CONTRACT_TYPE_TEMPLATE_TO_DB, EXEC_STATUS_TEMPLATE_TO_DB,
  GEO_PHOTOS_SHEET, IMPORT_LIMITS, LIST_VALUES, MGMT_ACTIONS_SHEET,
  PROJECT_REGISTER_COLUMNS, PROJECT_REGISTER_SHEET, PROJECT_STAGE_TEMPLATE_TO_DB,
  YES_NO_TO_BOOL, type ColumnDef,
} from '../lib/importTemplate.js';
import type { CreateProjectInput } from '../lib/projectFields.js';
import { createProjectSchema } from '../lib/projectFields.js';
import { createProject } from './projectsService.js';

// ─── Public types ────────────────────────────────────────────────────────

export type ImportMode = 'preview' | 'commit';

export interface FieldError {
  field: string;
  message: string;
}

export interface ImportRowResult {
  /** 1-based Excel row number (4 = first data row on Project Register). */
  rowNumber: number;
  /** Project name as read from the sheet (or '(blank)' if missing). */
  projectName: string;
  status: 'valid' | 'invalid' | 'imported' | 'skipped-duplicate' | 'skipped-error';
  errors?: FieldError[];
  /** After commit, the created projectId. */
  projectId?: string;
}

export interface ImportSummary {
  fileName?: string;
  mode: ImportMode;
  totals: {
    projectRowsRead: number;
    validRows: number;
    invalidRows: number;
    imported: number;
    skippedDuplicate: number;
    skippedError: number;
    childRowsAttached: number;
    childRowsSkipped: number;
  };
  rows: ImportRowResult[];
  /** Sheet-level errors (missing sheet, wrong headers, over-limit, etc.). */
  sheetErrors: string[];
}

// ─── Entrypoint ──────────────────────────────────────────────────────────

/**
 * Parse the workbook + validate + (if `commit`) insert. In `preview` mode,
 * nothing is written to the DB — the returned summary shows what WOULD
 * happen so the UI can render an error list before the user confirms.
 */
export async function importProjects(
  buffer: Buffer,
  actor: AuditActor,
  mode: ImportMode,
  fileName?: string,
): Promise<ImportSummary> {
  if (buffer.byteLength > IMPORT_LIMITS.MAX_FILE_SIZE) {
    throw new Error(`File exceeds max size (${Math.round(IMPORT_LIMITS.MAX_FILE_SIZE / 1024 / 1024)} MB)`);
  }

  const summary: ImportSummary = {
    mode,
    totals: {
      projectRowsRead: 0, validRows: 0, invalidRows: 0,
      imported: 0, skippedDuplicate: 0, skippedError: 0,
      childRowsAttached: 0, childRowsSkipped: 0,
    },
    rows: [],
    sheetErrors: [],
  };
  if (fileName !== undefined) summary.fileName = fileName;

  const wb = new ExcelJS.Workbook();
  try {
    // ExcelJS's .load() signature says Buffer, but at runtime it accepts
    // Buffer directly. Pass Node Buffer as-is; cast placates tsc.
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  } catch (e) {
    summary.sheetErrors.push(`Could not read workbook (${(e as Error).message}). Is this a valid .xlsx?`);
    return summary;
  }

  const registerSheet = wb.getWorksheet(PROJECT_REGISTER_SHEET);
  if (!registerSheet) {
    summary.sheetErrors.push(`Missing required sheet "${PROJECT_REGISTER_SHEET}". Use the provided template.`);
    return summary;
  }

  // Load lookup tables for name → ID resolution.
  const [sectors, divisions, allSchemes, existingByName] = await Promise.all([
    db.select().from(sector),
    db.select().from(division),
    db.select().from(scheme),
    db.select({ id: project.projectId, name: project.projectName }).from(project),
  ]);
  const sectorIdByName = mapByLower(sectors, (r) => [r.sectorName, r.sectorId]);
  const divisionIdByName = mapByLower(divisions, (r) => [r.divisionName, r.divisionId]);
  const schemeIdByName = mapByLower(allSchemes, (r) => [r.schemeName, r.schemeId]);
  const existingNames = new Set(existingByName.map((r) => r.name.trim().toLowerCase()));

  // ── Parse Project Register rows (starting at row 4) ─────────────────
  const parsedRows: Array<{ rowNumber: number; input: CreateProjectInput; original: Record<string, unknown> }> = [];
  for (let r = 4; r <= registerSheet.rowCount; r++) {
    const row = registerSheet.getRow(r);
    // Skip rows that are effectively blank (col B = Project Name empty).
    const nameCell = row.getCell(2).value;
    const projectName = coerceString(nameCell);
    if (!projectName || projectName.trim().length === 0) continue;

    summary.totals.projectRowsRead++;
    if (summary.totals.projectRowsRead > IMPORT_LIMITS.MAX_ROWS) {
      summary.sheetErrors.push(
        `Row ${r}: exceeds the max ${IMPORT_LIMITS.MAX_ROWS} project rows per import — stopping.`,
      );
      break;
    }

    // Duplicate check on project name.
    if (existingNames.has(projectName.trim().toLowerCase())) {
      summary.rows.push({
        rowNumber: r, projectName, status: 'skipped-duplicate',
        errors: [{ field: 'projectName', message: 'A project with this name already exists' }],
      });
      summary.totals.skippedDuplicate++;
      continue;
    }

    const { input, errors, original } = buildProjectInput(
      row, projectName, sectorIdByName, divisionIdByName, schemeIdByName,
    );
    if (errors.length > 0) {
      summary.rows.push({ rowNumber: r, projectName, status: 'invalid', errors });
      summary.totals.invalidRows++;
      continue;
    }
    summary.rows.push({ rowNumber: r, projectName, status: 'valid' });
    summary.totals.validRows++;
    parsedRows.push({ rowNumber: r, input, original });
  }

  if (mode === 'preview') return summary;

  // ── Commit: insert projects one-by-one via createProject ────────────
  const nameToInsertedId = new Map<string, string>();
  for (const p of parsedRows) {
    try {
      const created = await createProject(p.input, actor);
      nameToInsertedId.set(p.input.projectName.trim().toLowerCase(), created.projectId);
      const idx = summary.rows.findIndex((r) => r.rowNumber === p.rowNumber);
      if (idx >= 0) {
        summary.rows[idx]!.status = 'imported';
        summary.rows[idx]!.projectId = created.projectId;
      }
      summary.totals.imported++;
    } catch (e) {
      const msg = (e as Error).message ?? 'Insert failed';
      const idx = summary.rows.findIndex((r) => r.rowNumber === p.rowNumber);
      if (idx >= 0) {
        summary.rows[idx]!.status = 'skipped-error';
        summary.rows[idx]!.errors = [{ field: '_insert', message: msg }];
      }
      summary.totals.skippedError++;
    }
  }

  // Also expose previously-existing projects for child-sheet lookup.
  for (const r of existingByName) nameToInsertedId.set(r.name.trim().toLowerCase(), r.id);

  // ── Attach child-sheet rows ─────────────────────────────────────────
  await attachCosEotRows(wb, nameToInsertedId, summary);
  await attachMgmtRows(wb, nameToInsertedId, summary);
  await attachGeoPhotoRows(wb, nameToInsertedId, summary);

  return summary;
}

// ─── Row → CreateProjectInput ────────────────────────────────────────────

function buildProjectInput(
  row: ExcelJS.Row, projectName: string,
  sectorIdByName: Map<string, number>,
  divisionIdByName: Map<string, number>,
  schemeIdByName: Map<string, number>,
): { input: CreateProjectInput; errors: FieldError[]; original: Record<string, unknown> } {
  const errors: FieldError[] = [];
  const raw: Record<string, unknown> = {};
  const partial: Partial<CreateProjectInput> = { projectName };

  for (const col of PROJECT_REGISTER_COLUMNS) {
    if (!col.dbField) continue;
    if (col.dataType === 'Auto') continue;
    // Skip fields we don't map (Pre-Monsoon Critical, Outstanding Gap?, etc.)
    if (col.dbField === null) continue;
    const cell = row.getCell(col.index);
    const raw0 = cell.value;
    if (raw0 === null || raw0 === undefined || raw0 === '') continue;
    raw[col.header] = raw0;

    try {
      applyCellToInput(partial, col, raw0, sectorIdByName, divisionIdByName, schemeIdByName);
    } catch (e) {
      errors.push({ field: col.header, message: (e as Error).message });
    }
  }

  // Zod validation on the assembled input.
  const parsed = createProjectSchema.safeParse(partial);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    for (const [field, msgs] of Object.entries(flat)) {
      if (msgs) for (const m of msgs) errors.push({ field, message: m });
    }
    return { input: partial as CreateProjectInput, errors, original: raw };
  }
  return { input: parsed.data, errors, original: raw };
}

function applyCellToInput(
  out: Partial<CreateProjectInput>, col: ColumnDef, raw: unknown,
  sectorIdByName: Map<string, number>,
  divisionIdByName: Map<string, number>,
  schemeIdByName: Map<string, number>,
): void {
  const dbField = col.dbField!;

  // Named FK lookups
  if (dbField === 'sectorId') {
    const id = sectorIdByName.get(coerceString(raw).trim().toLowerCase());
    if (id === undefined) throw new Error(`Unknown sector "${coerceString(raw)}"`);
    (out as Record<string, unknown>).sectorId = id;
    return;
  }
  if (dbField === 'divisionId') {
    const id = divisionIdByName.get(coerceString(raw).trim().toLowerCase());
    if (id === undefined) throw new Error(`Unknown division "${coerceString(raw)}"`);
    (out as Record<string, unknown>).divisionId = id;
    return;
  }
  if (dbField === 'schemes') {
    // Comma-separated list; each name resolved to schemeId. Unknown names error.
    const parts = coerceString(raw).split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    const ids: number[] = [];
    for (const p of parts) {
      const id = schemeIdByName.get(p.toLowerCase());
      if (id === undefined) throw new Error(`Unknown scheme "${p}"`);
      ids.push(id);
    }
    (out as Record<string, unknown>).schemes = ids;
    return;
  }

  // Enum normalizations
  if (dbField === 'contractType') {
    const t = coerceString(raw).trim();
    const norm = CONTRACT_TYPE_TEMPLATE_TO_DB[t] ?? t;
    (out as Record<string, unknown>).contractType = norm;
    return;
  }
  if (dbField === 'projectStageV2') {
    const t = coerceString(raw).trim();
    const norm = PROJECT_STAGE_TEMPLATE_TO_DB[t] ?? t;
    (out as Record<string, unknown>).projectStageV2 = norm;
    return;
  }
  if (dbField === 'status') {
    const t = coerceString(raw).trim();
    // Accept both the code (NOT_STARTED) and the label ("Not Started").
    const norm = EXEC_STATUS_TEMPLATE_TO_DB[t] ?? t;
    (out as Record<string, unknown>).status = norm;
    return;
  }
  if (dbField === 'omApplicable') {
    const t = coerceString(raw).trim();
    if (t in YES_NO_TO_BOOL) (out as Record<string, unknown>).omApplicable = YES_NO_TO_BOOL[t];
    return;
  }

  // Priority + OMStatus — accept template values verbatim (they match the DB enums).
  if (col.dropdown === 'Priority' && !(LIST_VALUES.Priority as readonly string[]).includes(coerceString(raw).trim())) {
    throw new Error(`Priority must be one of ${LIST_VALUES.Priority.join(', ')}`);
  }
  if (col.dropdown === 'OMStatus' && !(LIST_VALUES.OMStatus as readonly string[]).includes(coerceString(raw).trim())) {
    throw new Error(`OMStatus must be one of ${LIST_VALUES.OMStatus.join(', ')}`);
  }

  // Dates → YYYY-MM-DD strings (CreateProject expects that format).
  if (col.dataType === 'Date') {
    (out as Record<string, unknown>)[dbField] = coerceDateString(raw);
    return;
  }
  // Numbers → number (Zod will coerce to strings before drizzle).
  if (col.dataType === 'Number') {
    const n = typeof raw === 'number' ? raw : Number(coerceString(raw));
    if (!Number.isFinite(n)) throw new Error(`Not a number: ${coerceString(raw)}`);
    (out as Record<string, unknown>)[dbField] = n;
    return;
  }

  // Text passthrough
  (out as Record<string, unknown>)[dbField] = coerceString(raw);
}

// ─── Child-sheet attachment ──────────────────────────────────────────────

async function attachCosEotRows(
  wb: ExcelJS.Workbook, nameToId: Map<string, string>, summary: ImportSummary,
): Promise<void> {
  const s = wb.getWorksheet(COS_EOT_SHEET);
  if (!s) return;
  for (let r = 2; r <= s.rowCount; r++) {
    const row = s.getRow(r);
    const nameCell = row.getCell(1).value;
    const projectName = coerceString(nameCell);
    if (!projectName || projectName.trim().length === 0) continue;
    const pid = nameToId.get(projectName.trim().toLowerCase());
    if (!pid) {
      summary.sheetErrors.push(`CoS-EoT Log row ${r}: project "${projectName}" not found — skipped.`);
      summary.totals.childRowsSkipped++;
      continue;
    }
    try {
      const values: Record<string, unknown> = { projectId: pid };
      const cosNumber = coerceString(row.getCell(2).value);
      if (cosNumber) values.cosNumber = cosNumber;
      const cosDate = coerceDateString(row.getCell(3).value);
      if (cosDate) values.cosDate = cosDate;
      const category = coerceString(row.getCell(4).value);
      if (category) values.category = category;
      const cosAmt = row.getCell(5).value;
      if (cosAmt !== null && cosAmt !== '') values.cosAmountCr = String(Number(cosAmt) || 0);
      const variation = row.getCell(6).value;
      if (variation !== null && variation !== '') values.variationPct = String(Number(variation) || 0);
      const eotNumber = coerceString(row.getCell(7).value);
      if (eotNumber) values.eotNumber = eotNumber;
      const eotDays = row.getCell(8).value;
      if (eotDays !== null && eotDays !== '') values.eotDaysGranted = Math.round(Number(eotDays));
      const timeLinked = coerceString(row.getCell(9).value).trim();
      if (timeLinked in YES_NO_TO_BOOL) values.timeLinked = YES_NO_TO_BOOL[timeLinked];
      const origEnd = coerceDateString(row.getCell(10).value);
      if (origEnd) values.originalEndDate = origEnd;
      const newEnd = coerceDateString(row.getCell(11).value);
      if (newEnd) values.newEndDate = newEnd;
      const revised = coerceDateString(row.getCell(12).value);
      if (revised) values.revisedDate = revised;
      await db.insert(cosEotItem).values(values as typeof cosEotItem.$inferInsert);
      summary.totals.childRowsAttached++;
    } catch (e) {
      summary.sheetErrors.push(`CoS-EoT Log row ${r}: ${(e as Error).message}`);
      summary.totals.childRowsSkipped++;
    }
  }
}

async function attachMgmtRows(
  wb: ExcelJS.Workbook, nameToId: Map<string, string>, summary: ImportSummary,
): Promise<void> {
  const s = wb.getWorksheet(MGMT_ACTIONS_SHEET);
  if (!s) return;
  for (let r = 2; r <= s.rowCount; r++) {
    const row = s.getRow(r);
    const projectName = coerceString(row.getCell(1).value);
    if (!projectName || projectName.trim().length === 0) continue;
    const pid = nameToId.get(projectName.trim().toLowerCase());
    if (!pid) {
      summary.sheetErrors.push(`Management Actions Log row ${r}: project "${projectName}" not found — skipped.`);
      summary.totals.childRowsSkipped++;
      continue;
    }
    try {
      const topic = coerceString(row.getCell(2).value);
      if (!topic) throw new Error('Topic is required');
      const statusVal = coerceString(row.getCell(3).value).trim() || 'Open';
      const deadline = coerceDateString(row.getCell(4).value);
      const values: Record<string, unknown> = {
        projectId: pid, topic, status: statusVal,
      };
      if (deadline) values.deadlineDate = deadline;
      await db.insert(managementActionItem).values(values as typeof managementActionItem.$inferInsert);
      summary.totals.childRowsAttached++;
    } catch (e) {
      summary.sheetErrors.push(`Management Actions Log row ${r}: ${(e as Error).message}`);
      summary.totals.childRowsSkipped++;
    }
  }
}

async function attachGeoPhotoRows(
  wb: ExcelJS.Workbook, nameToId: Map<string, string>, summary: ImportSummary,
): Promise<void> {
  const s = wb.getWorksheet(GEO_PHOTOS_SHEET);
  if (!s) return;
  for (let r = 2; r <= s.rowCount; r++) {
    const row = s.getRow(r);
    const projectName = coerceString(row.getCell(1).value);
    if (!projectName || projectName.trim().length === 0) continue;
    const pid = nameToId.get(projectName.trim().toLowerCase());
    if (!pid) {
      summary.sheetErrors.push(`GeoTagging Photos Log row ${r}: project "${projectName}" not found — skipped.`);
      summary.totals.childRowsSkipped++;
      continue;
    }
    try {
      const url = coerceString(row.getCell(2).value);
      if (!url) throw new Error('Photo URL is required');
      const caption = coerceString(row.getCell(3).value);
      const dateStr = coerceDateString(row.getCell(4).value);
      const values: Record<string, unknown> = { projectId: pid, url };
      if (caption) values.caption = caption;
      if (dateStr) values.photoDate = dateStr;
      await db.insert(geoPhoto).values(values as typeof geoPhoto.$inferInsert);
      summary.totals.childRowsAttached++;
    } catch (e) {
      summary.sheetErrors.push(`GeoTagging Photos Log row ${r}: ${(e as Error).message}`);
      summary.totals.childRowsSkipped++;
    }
  }
}

// ─── Cell coercion helpers ───────────────────────────────────────────────

function coerceString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object' && v && 'richText' in (v as Record<string, unknown>)) {
    // ExcelJS RichText — concatenate the .text of each run.
    const runs = (v as { richText: Array<{ text?: string }> }).richText ?? [];
    return runs.map((r) => r.text ?? '').join('');
  }
  if (typeof v === 'object' && v && 'result' in (v as Record<string, unknown>)) {
    // Formula cell — use the resolved result.
    return coerceString((v as { result?: unknown }).result);
  }
  if (typeof v === 'object' && v && 'text' in (v as Record<string, unknown>)) {
    return String((v as { text?: unknown }).text ?? '');
  }
  return String(v);
}

/** Coerce cell → 'YYYY-MM-DD' or null. Accepts Date, ISO string, dd-mmm-yyyy, dd/mm/yyyy. */
function coerceDateString(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = coerceString(v).trim();
  if (!s) return null;
  // yyyy-mm-dd already
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // dd-mmm-yyyy (e.g. 15-Mar-2026)
  const m1 = /^(\d{1,2})[-\s]([A-Za-z]{3,})[-\s](\d{4})$/.exec(s);
  if (m1) {
    const day = m1[1]!.padStart(2, '0');
    const monthName = m1[2]!.slice(0, 3).toLowerCase();
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const mm = months[monthName];
    if (mm) return `${m1[3]}-${mm}-${day}`;
  }
  // dd/mm/yyyy
  const m2 = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(s);
  if (m2) {
    return `${m2[3]}-${m2[2]!.padStart(2, '0')}-${m2[1]!.padStart(2, '0')}`;
  }
  // Fallback: Date.parse
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function mapByLower<T>(rows: T[], get: (r: T) => [string, number]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const [name, id] = get(r);
    m.set(name.trim().toLowerCase(), id);
  }
  return m;
}

// Referenced by callers who need direct DB access (currently only used in
// the child-attach helpers above — kept module-scoped otherwise).
export const __TEST_ONLY__ = { coerceString, coerceDateString };

// The following imports are only used inside child-attach helpers below —
// re-exported at the top of the file. This trailing block is here to
// silence any "unused import" warnings if child helpers get removed.
void eq;
