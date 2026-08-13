/**
 * Task 3 (bhaveshTask.md) — Import Project. Parses the uploaded Excel file
 * client-side (same `exceljs` library the Projects export already uses,
 * dynamically imported so the ~1MB parser only loads when this dialog is
 * actually opened), maps its columns onto the same payload shape a manual
 * Create Project sends, and validates every row before anything is POSTed.
 * Validation runs entirely client-side first so the user gets fast,
 * per-row feedback; the server re-validates with the same Zod schema as
 * defense in depth (see backend routes/projects.ts POST /import).
 */
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Workbook, Worksheet } from 'exceljs';
import { useGetLookupsQuery } from '../../app/api/lookupsApi';
import { useImportProjectsMutation } from '../../app/api/projectsApi';
import { Button } from '../ui/button';
import type { ProjectUpsertPayload } from '../../types/api';

const SHEET_NAME = 'Project Register';
const HEADER_ROW = 2;
// Row 3 is a legend row — every cell holds a type hint ("Text", "Dropdown:
// Sector", "Auto (formula)", …) rather than data. Real rows start at 4.
const FIRST_DATA_ROW = 4;

const CONTRACT_TYPES = ['Work Contract', 'Service Contract', 'O&M Contract', 'Others'] as const;
const PROJECT_STAGE_V2 = [
  'Conceptualisation', 'Design', 'Pre-Tender', 'Tender', 'Construction', 'O&M', 'Other',
] as const;
const STATUSES = ['Not Started', 'In Progress', 'Completed', 'On Hold', 'Delayed'] as const;
const PRIORITIES = ['High', 'Medium', 'Low', 'N/A'] as const;
const OM_STATUSES = ['Not Started', 'Ongoing', 'Expiring Soon', 'Expired', 'Handed Over to ULB'] as const;

type FieldKind = 'text' | 'number' | 'percent' | 'date' | 'enum' | 'yesno' | 'url' | 'sector' | 'division' | 'schemes';

interface FieldDef {
  /** Row-2 header text, whitespace-normalized (embedded newlines in the
   *  template's wrapped headers collapse to a single space). */
  header: string;
  key: keyof ProjectUpsertPayload;
  kind: FieldKind;
  options?: readonly string[];
}

/**
 * Maps every "Project Register" column onto a ProjectUpsertPayload field.
 * Columns intentionally NOT listed here (Region, Scheme / Category, Status
 * (auto), Pre-Monsoon Critical, Delay Days (auto), Total CoS Count (auto),
 * Total EoT Days (auto), Sanctioned Cost (auto), O&M End Date (auto,
 * override-able), Outstanding Gap?) are either server-derived, not modeled
 * on the project row, or redundant with a mapped column — those cells carry
 * live Excel formulas in the template and are simply ignored during import.
 */
const FIELD_DEFS: FieldDef[] = [
  { header: 'Project Name', key: 'projectName', kind: 'text' },
  { header: 'Sector', key: 'sectorId', kind: 'sector' },
  { header: 'Scheme(s)', key: 'schemes', kind: 'schemes' },
  { header: 'City', key: 'city', kind: 'text' },
  { header: 'Division', key: 'divisionId', kind: 'division' },
  { header: 'Contractor', key: 'contractor', kind: 'text' },
  { header: 'PD', key: 'pd', kind: 'text' },
  { header: 'Main Work', key: 'mainWork', kind: 'text' },
  { header: 'Physical Work Progress', key: 'physicalWorkProgressNote', kind: 'text' },
  { header: 'Contract Type', key: 'contractType', kind: 'enum', options: CONTRACT_TYPES },
  { header: 'Sponsoring Department', key: 'sponsoringDept', kind: 'text' },
  { header: 'Implementing Agency', key: 'implementingAgency', kind: 'text' },
  { header: 'Project Sanction Date', key: 'sanctionDate', kind: 'date' },
  { header: 'Project Brief', key: 'projectBrief', kind: 'text' },
  { header: 'Project Stage', key: 'projectStageV2', kind: 'enum', options: PROJECT_STAGE_V2 },
  { header: 'Execution Status', key: 'status', kind: 'enum', options: STATUSES },
  { header: 'Planned End Date', key: 'plannedEndDate', kind: 'date' },
  { header: 'Revised End Date', key: 'revisedEndDate', kind: 'date' },
  { header: 'Delay Reason / Root Cause', key: 'delayReason', kind: 'text' },
  { header: 'Department / Agency Stuck At', key: 'deptStuckAt', kind: 'text' },
  { header: 'Physical Progress % (Actual)', key: 'physicalProgressPct', kind: 'percent' },
  { header: 'Physical Progress % (Scheduled)', key: 'scheduledProgressPct', kind: 'percent' },
  { header: 'Financial Progress %', key: 'financialProgressPct', kind: 'percent' },
  { header: 'AA Amount (Rs. Cr.)', key: 'aaAmountCr', kind: 'number' },
  { header: 'Revised AA Amount (Rs. Cr.)', key: 'revisedAaAmountCr', kind: 'number' },
  { header: 'Agreement Amount (Rs. Cr.)', key: 'agreementAmountCr', kind: 'number' },
  { header: 'Financial Progress (Rs. Cr.)', key: 'financialProgressCr', kind: 'number' },
  { header: 'Agreement Number', key: 'agreementNumber', kind: 'text' },
  { header: 'Agreement Date', key: 'agreementDate', kind: 'date' },
  { header: 'Appointed Date', key: 'appointedDate', kind: 'date' },
  { header: 'Contract Value (Rs. Cr.)', key: 'contractValueCr', kind: 'number' },
  { header: 'Mobilization Advance (Rs. Cr.)', key: 'mobAdvanceIssuedCr', kind: 'number' },
  { header: 'Mob. Advance Recovered (Rs. Cr.)', key: 'mobAdvanceRecoveredCr', kind: 'number' },
  { header: 'PBG Number', key: 'pbgNumber', kind: 'text' },
  { header: 'PBG Amount (Rs. Cr.)', key: 'pbgAmountCr', kind: 'number' },
  { header: 'PBG Expiry Date', key: 'pbgExpiryDate', kind: 'date' },
  { header: 'PBG Issuing Bank', key: 'pbgIssuingBank', kind: 'text' },
  { header: 'EMD Amount (Rs. Cr.)', key: 'emdAmountCr', kind: 'number' },
  { header: 'EMD Reference Number', key: 'emdRefNumber', kind: 'text' },
  { header: 'EMD Date', key: 'emdDate', kind: 'date' },
  { header: 'Total Payments Made (Rs. Cr.)', key: 'totalPaymentsCr', kind: 'number' },
  { header: 'Last Payment Date', key: 'lastPaymentDate', kind: 'date' },
  { header: 'Last RA Bill No.', key: 'lastRaBillNo', kind: 'text' },
  { header: 'Retention Money Held (Rs. Cr.)', key: 'retentionMoneyHeldCr', kind: 'number' },
  { header: 'Geo-Tagging URL (overview link)', key: 'geoTaggingUrl', kind: 'url' },
  { header: 'Priority', key: 'priority', kind: 'enum', options: PRIORITIES },
  { header: 'Gap / Remark', key: 'remark', kind: 'text' },
  { header: 'O&M Applicable', key: 'omApplicable', kind: 'yesno' },
  { header: 'O&M Start Date', key: 'omStartDate', kind: 'date' },
  { header: 'Total O&M Period (Months)', key: 'omPeriodMonths', kind: 'number' },
  { header: 'O&M Agency / Contractor', key: 'omAgency', kind: 'text' },
  { header: 'O&M Status (Manual Override)', key: 'omStatusOverride', kind: 'enum', options: OM_STATUSES },
  { header: 'O&M Remarks', key: 'omRemarks', kind: 'text' },
];

function normalizeHeader(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * ExcelJS cell values can be a plain scalar, a Date, or a richText/formula/
 * hyperlink wrapper object — unwrap all of those down to a plain string.
 * The template's "(auto)" columns carry live formulas (e.g. O&M End Date's
 * `EDATE(...)`) that Excel hasn't calculated/cached a result for on a blank
 * input row — those have neither `.result` nor `.text`, and MUST resolve to
 * "" (not "[object Object]") so blank-row detection and validation both
 * treat them as empty rather than garbage text.
 */
function cellText(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === 'object') {
    const obj = raw as { text?: unknown; result?: unknown; richText?: Array<{ text?: string }>; formula?: unknown };
    if (Array.isArray(obj.richText)) return obj.richText.map((r) => r.text ?? '').join('');
    if (obj.result !== undefined) return obj.result === null ? '' : String(obj.result);
    if (obj.formula !== undefined) return '';
    if (obj.text !== undefined) return String(obj.text);
    return '';
  }
  return String(raw).trim();
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Excel's day-1 epoch is 1899-12-30 (not 1900-01-01), which bakes in the
 *  spreadsheet world's famous 1900-leap-year bug so serials stay consistent
 *  with every other tool that reads the same file. */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

/** Returns `undefined` for a blank cell (nothing to import), `null` for a
 *  cell whose text couldn't be parsed as a date (caller reports an error). */
function cellDate(raw: unknown): string | null | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined;
  if (raw instanceof Date) return ymd(raw);
  // A date-column cell that isn't styled as a date round-trips as a plain
  // Excel serial number (e.g. 46477) instead of a Date — still a valid date,
  // just missing cell formatting. Accept anything in a plausible date range
  // (~1950-2200) rather than rejecting it.
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 18262 && raw < 109574) {
    return ymd(new Date(EXCEL_EPOCH_MS + raw * 86_400_000));
  }
  const s = cellText(raw);
  if (s === '') return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Common spreadsheet fallback when the cell isn't date-formatted: DD/MM/YYYY or DD-MM-YYYY.
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${pad2(Number(m[1]))}-${pad2(Number(m[2]))}`;
  return null;
}

function cellNumber(raw: unknown): number | null | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const s = cellText(raw).replace(/,/g, '');
  if (s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function matchEnum(raw: unknown, options: readonly string[]): string | null | undefined {
  const s = cellText(raw);
  if (s === '') return undefined;
  const exact = options.find((o) => o === s);
  if (exact) return exact;
  const ci = options.find((o) => o.toLowerCase() === s.toLowerCase());
  return ci ?? null;
}

function matchYesNo(raw: unknown): boolean | undefined | null {
  const s = cellText(raw).toLowerCase();
  if (s === '') return undefined;
  if (s === 'yes' || s === 'y' || s === 'true') return true;
  if (s === 'no' || s === 'n' || s === 'false') return false;
  return null;
}

interface RowError {
  row: number;
  messages: string[];
}

interface ParsedRow {
  row: number;
  projectName: string;
  payload: ProjectUpsertPayload;
}

interface ParseResult {
  structuralError: string | null;
  rows: ParsedRow[];
  errors: RowError[];
}

function parseWorkbook(
  sheet: Worksheet,
  lookups: { sectorByName: Map<string, number>; divisionByName: Map<string, number>; schemeByName: Map<string, number> },
): ParseResult {
  const headerRow = sheet.getRow(HEADER_ROW);
  const colByKey = new Map<string, number>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const header = normalizeHeader(cellText(cell.value));
    const def = FIELD_DEFS.find((f) => f.header === header);
    if (def) colByKey.set(def.key, colNumber);
  });

  if (!colByKey.has('projectName')) {
    return {
      structuralError:
        'Could not find the "Project Name" column on the "Project Register" sheet. Please use the Download Template button and fill that file in without changing its headers.',
      rows: [],
      errors: [],
    };
  }

  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];

  for (let r = FIRST_DATA_ROW; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const getRaw = (key: string): unknown => {
      const col = colByKey.get(key);
      return col ? row.getCell(col).value : undefined;
    };

    const projectNameRaw = cellText(getRaw('projectName'));
    const rowHasAnyValue = FIELD_DEFS.some((f) => cellText(getRaw(f.key)) !== '');
    if (!rowHasAnyValue) continue; // blank template row — nothing to import

    const messages: string[] = [];
    const payload: Record<string, unknown> = {};

    if (projectNameRaw === '') {
      messages.push('Project Name is required.');
    } else {
      payload.projectName = projectNameRaw;
    }

    for (const def of FIELD_DEFS) {
      if (def.key === 'projectName') continue;
      const raw = getRaw(def.key);

      switch (def.kind) {
        case 'text': {
          const s = cellText(raw);
          payload[def.key] = s === '' ? undefined : s;
          break;
        }
        case 'number':
        case 'percent': {
          const n = cellNumber(raw);
          if (n === null) {
            messages.push(`"${def.header}" must be a number.`);
          } else if (n !== undefined && def.kind === 'percent' && (n < 0 || n > 100)) {
            messages.push(`"${def.header}" must be between 0 and 100.`);
          } else {
            payload[def.key] = n;
          }
          break;
        }
        case 'date': {
          const d = cellDate(raw);
          if (d === null) {
            messages.push(`"${def.header}" is not a valid date (use YYYY-MM-DD or a real Excel date).`);
          } else {
            payload[def.key] = d;
          }
          break;
        }
        case 'enum': {
          const v = matchEnum(raw, def.options ?? []);
          if (v === null) {
            messages.push(`"${def.header}" value "${cellText(raw)}" is not valid — expected one of: ${(def.options ?? []).join(', ')}.`);
          } else {
            payload[def.key] = v;
          }
          break;
        }
        case 'yesno': {
          const v = matchYesNo(raw);
          if (v === null) {
            messages.push(`"${def.header}" must be Yes or No.`);
          } else if (v !== undefined) {
            payload[def.key] = v;
          }
          break;
        }
        case 'url': {
          const s = cellText(raw);
          if (s === '') break;
          if (!/^https?:\/\//i.test(s)) {
            messages.push(`"${def.header}" must be a full http(s):// URL.`);
          } else {
            payload[def.key] = s;
          }
          break;
        }
        case 'sector': {
          const s = cellText(raw);
          if (s === '') break;
          const id = lookups.sectorByName.get(s.toLowerCase());
          if (!id) messages.push(`Sector "${s}" does not match any known sector.`);
          else payload.sectorId = id;
          break;
        }
        case 'division': {
          const s = cellText(raw);
          if (s === '') break;
          const id = lookups.divisionByName.get(s.toLowerCase());
          if (!id) messages.push(`Division "${s}" does not match any known division.`);
          else payload.divisionId = id;
          break;
        }
        case 'schemes': {
          const s = cellText(raw);
          if (s === '') break;
          const names = s.split(/[,;\n]/).map((x) => x.trim()).filter((x) => x !== '');
          const ids: number[] = [];
          for (const name of names) {
            const id = lookups.schemeByName.get(name.toLowerCase());
            if (!id) messages.push(`Scheme "${name}" does not match any known scheme.`);
            else ids.push(id);
          }
          if (ids.length > 0) payload.schemes = ids;
          break;
        }
      }
    }

    if (messages.length > 0) {
      errors.push({ row: r, messages });
    } else {
      rows.push({ row: r, projectName: projectNameRaw, payload: payload as ProjectUpsertPayload });
    }
  }

  return { structuralError: null, rows, errors };
}

type Stage = 'idle' | 'parsing' | 'preview' | 'importing' | 'done';

export function ImportProjectDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const navigate = useNavigate();
  const lookups = useGetLookupsQuery();
  const [importProjects] = useImportProjectsMutation();

  const [stage, setStage] = useState<Stage>('idle');
  const [fileName, setFileName] = useState<string | null>(null);
  const [structuralError, setStructuralError] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [rowErrors, setRowErrors] = useState<RowError[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdCount, setCreatedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetToIdle = (): void => {
    setStage('idle');
    setFileName(null);
    setStructuralError(null);
    setRows([]);
    setRowErrors([]);
    setSubmitError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFile = async (file: File): Promise<void> => {
    setFileName(file.name);
    setStage('parsing');
    setStructuralError(null);
    setSubmitError(null);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook: Workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.getWorksheet(SHEET_NAME);
      if (!sheet) {
        setStructuralError(
          `This file has no "${SHEET_NAME}" sheet. Please use the Download Template button and fill that file in.`,
        );
        setStage('preview');
        return;
      }

      const sectorByName = new Map((lookups.data?.sectors ?? []).map((s) => [s.sectorName.toLowerCase(), s.sectorId]));
      const divisionByName = new Map((lookups.data?.divisions ?? []).map((d) => [d.divisionName.toLowerCase(), d.divisionId]));
      const schemeByName = new Map((lookups.data?.schemes ?? []).map((s) => [s.schemeName.toLowerCase(), s.schemeId]));

      const result = parseWorkbook(sheet, { sectorByName, divisionByName, schemeByName });
      setStructuralError(result.structuralError);
      setRows(result.rows);
      setRowErrors(result.errors);
      setStage('preview');
    } catch {
      setStructuralError('Could not read this file. Make sure it is a valid .xlsx file.');
      setStage('preview');
    }
  };

  const handleImport = async (): Promise<void> => {
    setStage('importing');
    setSubmitError(null);
    try {
      const res = await importProjects({ items: rows.map((r) => r.payload) }).unwrap();
      setCreatedCount(res.items.length);
      setStage('done');
    } catch (err) {
      setSubmitError(readError(err));
      setStage('preview');
    }
  };

  const canImport = stage === 'preview' && !structuralError && rowErrors.length === 0 && rows.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-3" role="dialog" aria-modal="true" aria-labelledby="import-project-title">
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={stage === 'importing' ? undefined : onClose}
      />
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-[#E5E7EB] bg-white shadow-2xl">
        <header className="border-b border-[#F3F4F6] px-5 py-3.5">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">Add New Project</p>
          <h3 id="import-project-title" className="mt-0.5 text-[14.5px] font-bold text-[#111827]">
            Import Project
          </h3>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {stage === 'done' ? (
            <div className="rounded border border-[#86EFAC] bg-[#F0FDF4] px-3 py-2.5 text-[13px] text-[#15803D]">
              ✓ {createdCount} project{createdCount === 1 ? '' : 's'} created from {fileName}.
            </div>
          ) : (
            <>
              <p className="text-[12.5px] text-[#6B7280]">
                Upload an Excel file that follows the Download Template structure. Every row is
                validated before anything is saved — if any row has a problem, nothing is imported.
              </p>
              <label className="grid gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                  Excel file (.xlsx)
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  disabled={stage === 'parsing' || stage === 'importing' || lookups.isLoading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                  }}
                  className="text-[13px] text-[#111827] file:mr-3 file:rounded file:border-0 file:bg-[#1E3A5F] file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-white disabled:cursor-not-allowed disabled:opacity-50"
                />
              </label>

              {lookups.isLoading ? (
                <p className="text-[11.5px] text-[#6B7280]">Loading sector/division/scheme lists…</p>
              ) : null}
              {stage === 'parsing' ? <p className="text-[12.5px] text-[#6B7280]">Reading {fileName}…</p> : null}

              {structuralError ? (
                <div className="rounded border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2.5 text-[12.5px] text-[#B91C1C]">
                  {structuralError}
                </div>
              ) : null}

              {stage === 'preview' && !structuralError && rowErrors.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[12.5px] font-semibold text-[#B91C1C]">
                    {rowErrors.length} row{rowErrors.length === 1 ? '' : 's'} need fixing before anything can be imported:
                  </p>
                  <ul className="max-h-52 space-y-1.5 overflow-y-auto rounded border border-[#FCA5A5] bg-[#FEF2F2] p-2.5 text-[12px] text-[#B91C1C]">
                    {rowErrors.map((e) => (
                      <li key={e.row}>
                        <span className="font-semibold">Row {e.row}:</span> {e.messages.join(' ')}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {stage === 'preview' && !structuralError && rowErrors.length === 0 && rows.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[12.5px] font-semibold text-[#15803D]">
                    {rows.length} project{rows.length === 1 ? '' : 's'} ready to import:
                  </p>
                  <ul className="max-h-52 space-y-1 overflow-y-auto rounded border border-[#E5E7EB] bg-[#F9FAFB] p-2.5 text-[12px] text-[#374151]">
                    {rows.map((r) => (
                      <li key={r.row}>Row {r.row} — {r.projectName}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {stage === 'preview' && !structuralError && rowErrors.length === 0 && rows.length === 0 ? (
                <p className="text-[12.5px] text-[#B45309]">
                  No filled-in rows were found below the header. Fill in at least one row and try again.
                </p>
              ) : null}

              {submitError ? (
                <div className="rounded border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2.5 text-[12.5px] text-[#B91C1C]">
                  {submitError}
                </div>
              ) : null}
            </>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[#F3F4F6] px-5 py-3">
          {stage === 'done' ? (
            <Button size="sm" onClick={() => navigate('/projects')}>Close</Button>
          ) : (
            <>
              {rows.length > 0 || rowErrors.length > 0 || structuralError ? (
                <Button variant="outline" size="sm" onClick={resetToIdle} disabled={stage === 'importing'}>
                  Choose a different file
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={onClose} disabled={stage === 'importing'}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void handleImport()} disabled={!canImport}>
                {stage === 'importing' ? 'Importing…' : `Import ${rows.length || ''} Project${rows.length === 1 ? '' : 's'}`}
              </Button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

function readError(err: unknown): string {
  if (err && typeof err === 'object' && 'data' in err) {
    const data = (err as { data?: unknown }).data;
    if (data && typeof data === 'object' && 'error' in data) {
      const e = (data as { error?: { message?: string } }).error;
      if (e?.message) return e.message;
    }
  }
  return 'Import failed. Please retry.';
}
