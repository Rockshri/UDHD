/**
 * Generates BUIDCO_Input_Sheet_Template.xlsx — one flat sheet, every
 * Input Sheet field as a column, dropdown validation on enums, and
 * separate reference sheets seeded live from the DB for
 * districts / sectors / schemes.
 *
 * Usage:  npm run gen:input-template
 * Output: backend/templates/BUIDCO_Input_Sheet_Template.xlsx
 */

import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { db, pool } from '../db/client.js';
import { district, scheme, sector } from '../db/schema.js';

/* ============================================================
 * Column catalogue — grouped by section, in the order the Input
 * Sheet displays them.
 * ============================================================ */

type ColumnType = 'text' | 'number' | 'percent' | 'date' | 'enum' | 'lookup' | 'multi-lookup' | 'yesno';

interface ColumnSpec {
  section: string;
  header: string;
  key: string;
  type: ColumnType;
  required?: boolean;
  enumValues?: readonly string[];
  lookupSheet?: 'Districts' | 'Sectors' | 'Schemes';
  note?: string;
  width?: number;
}

const STATUS_ENUM = ['Not Started', 'In Progress', 'Completed', 'On Hold', 'Delayed'] as const;
const STAGE_ENUM = ['Conceptualization', 'Pre-Tender', 'Tender', 'Construction', 'O&M'] as const;
const CURRENT_PHASE_ENUM = [
  'Conceptualization',
  'Design',
  'Pre-Tender',
  'Tender',
  'Construction',
  'O&M',
  'Completed',
] as const;
const WORK_TYPE_ENUM = ['Tender Work', 'Tender Service', 'Pre-Monsoon', 'Construction', 'Others'] as const;
const PRIORITY_ENUM = ['High', 'Medium', 'Low', 'N/A'] as const;
const OM_STATUS_ENUM = ['Not Started', 'Ongoing', 'Expiring Soon', 'Expired', 'Handed Over to ULB'] as const;
const YES_NO_ENUM = ['Yes', 'No'] as const;

const COLUMNS: ColumnSpec[] = [
  /* Section 01 — Basic Info */
  { section: '01 Basic Info', header: 'Project Name *', key: 'projectName', type: 'text', required: true, width: 42 },
  { section: '01 Basic Info', header: 'Sector', key: 'sectorId', type: 'lookup', lookupSheet: 'Sectors', note: 'Pick from Sectors sheet — enter Sector Name; importer resolves ID.' },
  { section: '01 Basic Info', header: 'City', key: 'city', type: 'text' },
  { section: '01 Basic Info', header: 'District', key: 'districtId', type: 'lookup', lookupSheet: 'Districts', note: 'Pick from Districts sheet — enter District Name; importer resolves ID.' },
  { section: '01 Basic Info', header: 'Contractor', key: 'contractor', type: 'text', width: 30 },
  { section: '01 Basic Info', header: 'PD (Project Director)', key: 'pd', type: 'text' },
  { section: '01 Basic Info', header: 'Scheme(s)', key: 'schemes', type: 'multi-lookup', lookupSheet: 'Schemes', note: 'Comma-separated list of scheme names, e.g. "AMRUT 1.0, SAAT NISHCHAY".', width: 32 },
  { section: '01 Basic Info', header: 'Main Work', key: 'mainWork', type: 'text', width: 40 },
  { section: '01 Basic Info', header: 'Physical Work Progress (note)', key: 'physicalWorkProgressNote', type: 'text', width: 32 },
  { section: '01 Basic Info', header: 'Project Stage', key: 'projectStage', type: 'enum', enumValues: STAGE_ENUM },
  { section: '01 Basic Info', header: 'Work Type', key: 'workType', type: 'enum', enumValues: WORK_TYPE_ENUM },
  { section: '01 Basic Info', header: 'Sponsoring Dept', key: 'sponsoringDept', type: 'text', width: 26 },
  { section: '01 Basic Info', header: 'Implementing Agency', key: 'implementingAgency', type: 'text', width: 26 },
  { section: '01 Basic Info', header: 'Project Sanction Date', key: 'sanctionDate', type: 'date' },
  { section: '01 Basic Info', header: 'Project Brief', key: 'projectBrief', type: 'text', width: 46 },

  /* Section 02 — Phase & Dates */
  { section: '02 Phase & Dates', header: 'Current Phase', key: 'currentPhase', type: 'enum', enumValues: CURRENT_PHASE_ENUM },
  { section: '02 Phase & Dates', header: 'Status', key: 'status', type: 'enum', enumValues: STATUS_ENUM, note: 'Defaults to "Not Started" if left blank.' },
  { section: '02 Phase & Dates', header: 'Planned End Date', key: 'plannedEndDate', type: 'date' },
  { section: '02 Phase & Dates', header: 'Revised End Date', key: 'revisedEndDate', type: 'date' },
  { section: '02 Phase & Dates', header: 'Delay Reason / Root Cause', key: 'delayReason', type: 'text', width: 40 },
  { section: '02 Phase & Dates', header: 'Department / Agency Stuck At', key: 'deptStuckAt', type: 'text', width: 26 },
  { section: '02 Phase & Dates', header: 'Expected Completion (date)', key: 'expectedCompletionDate', type: 'date' },
  { section: '02 Phase & Dates', header: 'Expected Completion (raw text)', key: 'expectedCompletionRaw', type: 'text', note: 'Use only if raw source is not a real calendar date.' },

  /* Section 03 — Progress & Financial */
  { section: '03 Progress & Financial', header: 'Priority', key: 'priority', type: 'enum', enumValues: PRIORITY_ENUM },
  { section: '03 Progress & Financial', header: 'Sanctioned Cost (₹ Cr)', key: 'sanctionedCostCr', type: 'number' },
  { section: '03 Progress & Financial', header: 'AA Amount (₹ Cr)', key: 'aaAmountCr', type: 'number' },
  { section: '03 Progress & Financial', header: 'Agreement Amount (₹ Cr)', key: 'agreementAmountCr', type: 'number' },
  { section: '03 Progress & Financial', header: 'Physical Progress % (Actual)', key: 'physicalProgressPct', type: 'percent' },
  { section: '03 Progress & Financial', header: 'Financial Progress (₹ Cr)', key: 'financialProgressCr', type: 'number' },
  { section: '03 Progress & Financial', header: 'Financial Progress %', key: 'financialProgressPct', type: 'percent' },
  { section: '03 Progress & Financial', header: 'Scheduled Progress %', key: 'scheduledProgressPct', type: 'percent' },

  /* Section 05 — Contract & Security */
  { section: '05 Contract & Security', header: 'Agreement Number', key: 'agreementNumber', type: 'text' },
  { section: '05 Contract & Security', header: 'Agreement Date', key: 'agreementDate', type: 'date' },
  { section: '05 Contract & Security', header: 'Appointed Date', key: 'appointedDate', type: 'date' },
  { section: '05 Contract & Security', header: 'Contract Value (₹ Cr)', key: 'contractValueCr', type: 'number' },
  { section: '05 Contract & Security', header: 'Mobilisation Advance Issued (₹ Cr)', key: 'mobAdvanceIssuedCr', type: 'number' },
  { section: '05 Contract & Security', header: 'Mob. Advance Recovered (₹ Cr)', key: 'mobAdvanceRecoveredCr', type: 'number' },
  { section: '05 Contract & Security', header: 'Advance Outstanding (₹ Cr)', key: 'advanceOutstandingCr', type: 'number' },
  { section: '05 Contract & Security', header: 'Retention Money Held (₹ Cr)', key: 'retentionMoneyHeldCr', type: 'number' },
  { section: '05 Contract & Security', header: 'PBG Number', key: 'pbgNumber', type: 'text' },
  { section: '05 Contract & Security', header: 'PBG Amount (₹ Cr)', key: 'pbgAmountCr', type: 'number' },
  { section: '05 Contract & Security', header: 'PBG Expiry Date', key: 'pbgExpiryDate', type: 'date' },
  { section: '05 Contract & Security', header: 'PBG Issuing Bank', key: 'pbgIssuingBank', type: 'text', width: 26 },
  { section: '05 Contract & Security', header: 'EMD Amount (₹ Cr)', key: 'emdAmountCr', type: 'number' },
  { section: '05 Contract & Security', header: 'EMD Reference Number', key: 'emdRefNumber', type: 'text' },
  { section: '05 Contract & Security', header: 'EMD Date', key: 'emdDate', type: 'date' },
  { section: '05 Contract & Security', header: 'Total Payments Made (₹ Cr)', key: 'totalPaymentsCr', type: 'number' },
  { section: '05 Contract & Security', header: 'Last Payment Date', key: 'lastPaymentDate', type: 'date' },
  { section: '05 Contract & Security', header: 'Last RA Bill No.', key: 'lastRaBillNo', type: 'text' },

  /* Section 06 — GeoTagging */
  { section: '06 GeoTagging', header: 'Geo-Tagging URL', key: 'geoTaggingUrl', type: 'text', width: 42, note: 'Full https:// URL (leave blank if none).' },

  /* Section 07 — Action & Remarks */
  { section: '07 Action & Remarks', header: 'Outstanding Gap / Remark', key: 'remark', type: 'text', width: 46, note: 'Fill only if there is an outstanding gap; blank means "no gap".' },

  /* Section 08 — O&M */
  { section: '08 O&M', header: 'O&M Applicable', key: 'omApplicable', type: 'yesno' },
  { section: '08 O&M', header: 'O&M Start Date', key: 'omStartDate', type: 'date' },
  { section: '08 O&M', header: 'O&M Period (Months)', key: 'omPeriodMonths', type: 'number' },
  { section: '08 O&M', header: 'O&M End Date', key: 'omEndDate', type: 'date' },
  { section: '08 O&M', header: 'O&M Agency', key: 'omAgency', type: 'text', width: 26 },
  { section: '08 O&M', header: 'O&M Status (Manual Override)', key: 'omStatusOverride', type: 'enum', enumValues: OM_STATUS_ENUM },
  { section: '08 O&M', header: 'O&M Remarks', key: 'omRemarks', type: 'text', width: 40 },

  /* Section 03B — MPR (imported alongside Section 03 in the UI, kept together for the flat sheet) */
  { section: '03B MPR', header: 'MPR Month', key: 'mprMonth', type: 'text' },
  { section: '03B MPR', header: 'Fund Received (₹ Cr)', key: 'fundReceivedCr', type: 'number' },
  { section: '03B MPR', header: 'Expenditure — Central Share (raw)', key: 'expenditureCentralRaw', type: 'text' },
  { section: '03B MPR', header: 'Expenditure — State Share (raw)', key: 'expenditureStateRaw', type: 'text' },
  { section: '03B MPR', header: 'Manpower Engaged', key: 'manpowerEngagedRaw', type: 'text' },
  { section: '03B MPR', header: 'Main Component (with scope)', key: 'mainComponentScope', type: 'text', width: 40 },
  { section: '03B MPR', header: 'Progress — Up to Previous Month', key: 'progressPrevMonthRaw', type: 'text' },
  { section: '03B MPR', header: 'Progress — During This Month', key: 'progressThisMonthRaw', type: 'text' },
  { section: '03B MPR', header: 'MPR Remarks', key: 'mprRemark', type: 'text', width: 40 },
];

/* Colour tokens matching the reference JSX section palette. */
const SECTION_COLOR: Record<string, string> = {
  '01 Basic Info': 'FF1E3A5F',
  '02 Phase & Dates': 'FF7C3AED',
  '03 Progress & Financial': 'FF15803D',
  '03B MPR': 'FF166534',
  '05 Contract & Security': 'FFB45309',
  '06 GeoTagging': 'FF0EA5E9',
  '07 Action & Remarks': 'FFB91C1C',
  '08 O&M': 'FF6B7280',
};

/* ============================================================
 * Sheet builders
 * ============================================================ */

interface Lookups {
  districts: Array<{ id: number; name: string }>;
  sectors: Array<{ id: number; name: string }>;
  schemes: Array<{ id: number; name: string }>;
}

async function loadLookups(): Promise<Lookups> {
  const [districts, sectors, schemes] = await Promise.all([
    db.select({ id: district.districtId, name: district.districtName }).from(district).orderBy(district.districtName),
    db.select({ id: sector.sectorId, name: sector.sectorName }).from(sector).orderBy(sector.sectorName),
    db.select({ id: scheme.schemeId, name: scheme.schemeName }).from(scheme).orderBy(scheme.schemeName),
  ]);
  return { districts, sectors, schemes };
}

function addReferenceSheet(
  wb: ExcelJS.Workbook,
  name: 'Districts' | 'Sectors' | 'Schemes',
  rows: Array<{ id: number; name: string }>,
): void {
  const ws = wb.addWorksheet(name, {
    properties: { tabColor: { argb: 'FF6B7280' } },
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  ws.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Name', key: 'name', width: 44 },
  ];
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  for (const r of rows) ws.addRow(r);
  ws.autoFilter = { from: 'A1', to: `B${rows.length + 1}` };
}

function addEnumsSheet(wb: ExcelJS.Workbook): void {
  const ws = wb.addWorksheet('Enums', {
    properties: { tabColor: { argb: 'FF9CA3AF' } },
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  const enums: Array<[string, readonly string[]]> = [
    ['Status', STATUS_ENUM],
    ['Project Stage', STAGE_ENUM],
    ['Current Phase', CURRENT_PHASE_ENUM],
    ['Work Type', WORK_TYPE_ENUM],
    ['Priority', PRIORITY_ENUM],
    ['O&M Status', OM_STATUS_ENUM],
    ['Yes/No', YES_NO_ENUM],
  ];
  const maxLen = Math.max(...enums.map(([, vals]) => vals.length));
  ws.columns = enums.map(([label]) => ({ header: label, key: label, width: 22 }));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  for (let i = 0; i < maxLen; i++) {
    const rowValues = enums.map(([, vals]) => vals[i] ?? '');
    ws.addRow(rowValues);
  }
}

function addReadmeSheet(wb: ExcelJS.Workbook): void {
  const ws = wb.addWorksheet('README', {
    properties: { tabColor: { argb: 'FF15803D' } },
  });
  ws.columns = [{ width: 110 }];
  const lines: Array<{ text: string; bold?: boolean; size?: number; color?: string }> = [
    { text: 'BUIDCO Input Sheet — Bulk Data Template', bold: true, size: 16, color: 'FF1E3A5F' },
    { text: '' },
    { text: 'How to use', bold: true, size: 12 },
    { text: '1. Open the "Projects" sheet.' },
    { text: '2. Each row is one project. Fill Project Name (mandatory) and any other fields you have.' },
    { text: '3. Leave a cell blank if you don\'t have that data. Blank = no change / not set.' },
    { text: '4. Columns are colour-grouped by section (Basic Info, Phase & Dates, Progress, Contract & Security, GeoTagging, Action & Remarks, O&M, MPR).' },
    { text: '5. Enum columns (Status, Priority, Stage, Work Type, O&M Status, Yes/No) have dropdowns — pick a value from the list.' },
    { text: '6. Lookup columns (Sector, District) also have dropdowns backed by the "Sectors" and "Districts" reference sheets.' },
    { text: '7. Scheme(s) is a comma-separated list — e.g. "AMRUT 1.0, SAAT NISHCHAY" — one project can belong to multiple schemes.' },
    { text: '' },
    { text: 'Numeric conventions', bold: true, size: 12 },
    { text: '• All money amounts are ₹ Crore (not lakhs, not rupees).' },
    { text: '• All percentages are 0–100 (write 42.5, not 0.425).' },
    { text: '• Dates: use Excel date cells or type as YYYY-MM-DD (e.g. 2027-01-15).' },
    { text: '' },
    { text: 'Reference sheets', bold: true, size: 12 },
    { text: '• Districts / Sectors / Schemes — live copies of what the backend accepts.' },
    { text: '• Enums — every dropdown value list, one column per enum type.' },
    { text: '' },
    { text: 'Import path', bold: true, size: 12 },
    { text: 'Once filled, this workbook can be handed to the backend team for bulk import via a script that reads the Projects sheet and calls POST /api/projects for each row.' },
    { text: '' },
    { text: `Generated: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}Z`, color: 'FF6B7280' },
  ];
  for (const l of lines) {
    const row = ws.addRow([l.text]);
    row.font = {
      bold: l.bold ?? false,
      size: l.size ?? 11,
      color: l.color ? { argb: l.color } : undefined,
    };
    row.alignment = { wrapText: true, vertical: 'top' };
  }
}

function toColumnLetter(index: number): string {
  let n = index;
  let out = '';
  while (n >= 0) {
    out = String.fromCharCode((n % 26) + 65) + out;
    n = Math.floor(n / 26) - 1;
  }
  return out;
}

/**
 * ExcelJS types don't expose `dataValidations` on Worksheet, but the
 * property exists at runtime (see exceljs docs on data validations).
 * Cast through this helper so the workaround lives in one place.
 */
interface DataValidation {
  type: 'list' | 'decimal' | 'date' | 'whole' | 'textLength';
  allowBlank?: boolean;
  operator?: string;
  formulae?: unknown[];
  showErrorMessage?: boolean;
  errorTitle?: string;
  error?: string;
}
interface WorksheetWithValidations {
  dataValidations: { add: (range: string, opts: DataValidation) => void };
}
function addValidation(ws: ExcelJS.Worksheet, range: string, opts: DataValidation): void {
  (ws as unknown as WorksheetWithValidations).dataValidations.add(range, opts);
}

function addProjectsSheet(wb: ExcelJS.Workbook, lookups: Lookups): void {
  const ws = wb.addWorksheet('Projects', {
    properties: { tabColor: { argb: 'FF1E3A5F' } },
    views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }],
  });

  /* Row 1: section band. Row 2: field header. Data starts row 3. */
  const sectionRow = ws.getRow(1);
  const headerRow = ws.getRow(2);

  ws.columns = COLUMNS.map((c) => ({ key: c.key, width: c.width ?? 20 }));

  COLUMNS.forEach((col, idx) => {
    const excelIdx = idx + 1;
    const letter = toColumnLetter(idx);
    const sectionCell = sectionRow.getCell(excelIdx);
    sectionCell.value = col.section;
    sectionCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    sectionCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sectionCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: SECTION_COLOR[col.section] ?? 'FF6B7280' },
    };

    const headerCell = headerRow.getCell(excelIdx);
    headerCell.value = col.header;
    headerCell.font = {
      bold: true,
      color: { argb: col.required ? 'FFB91C1C' : 'FF111827' },
      size: 11,
    };
    headerCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' },
    };
    headerCell.alignment = { wrapText: true, vertical: 'middle' };
    headerCell.border = { bottom: { style: 'medium', color: { argb: 'FF1E3A5F' } } };
    if (col.note) {
      headerCell.note = col.note;
    }

    /* Prime an empty range for data-validation — 500 rows is plenty. */
    const range = `${letter}3:${letter}502`;

    switch (col.type) {
      case 'enum': {
        if (col.enumValues) {
          addValidation(ws, range, {
            type: 'list',
            allowBlank: true,
            formulae: [`"${col.enumValues.join(',')}"`],
            showErrorMessage: true,
            errorTitle: 'Invalid value',
            error: `Pick one of: ${col.enumValues.join(', ')}`,
          });
        }
        break;
      }
      case 'yesno': {
        addValidation(ws, range, {
          type: 'list',
          allowBlank: true,
          formulae: ['"Yes,No"'],
          showErrorMessage: true,
          errorTitle: 'Invalid value',
          error: 'Pick Yes or No.',
        });
        break;
      }
      case 'lookup': {
        if (col.lookupSheet) {
          const sheetName = col.lookupSheet;
          const count =
            sheetName === 'Districts'
              ? lookups.districts.length
              : sheetName === 'Sectors'
                ? lookups.sectors.length
                : lookups.schemes.length;
          if (count > 0) {
            addValidation(ws, range, {
              type: 'list',
              allowBlank: true,
              formulae: [`=${sheetName}!$B$2:$B$${count + 1}`],
              showErrorMessage: true,
              errorTitle: 'Invalid value',
              error: `Pick a name from the ${sheetName} sheet.`,
            });
          }
        }
        break;
      }
      case 'number': {
        addValidation(ws, range, {
          type: 'decimal',
          allowBlank: true,
          operator: 'greaterThanOrEqual',
          formulae: [0],
          showErrorMessage: true,
          errorTitle: 'Invalid number',
          error: 'Enter a non-negative number (e.g. 12.5).',
        });
        break;
      }
      case 'percent': {
        addValidation(ws, range, {
          type: 'decimal',
          allowBlank: true,
          operator: 'between',
          formulae: [0, 100],
          showErrorMessage: true,
          errorTitle: 'Invalid percentage',
          error: 'Enter a number between 0 and 100 (e.g. 42.5, not 0.425).',
        });
        break;
      }
      case 'date': {
        addValidation(ws, range, {
          type: 'date',
          allowBlank: true,
          operator: 'greaterThan',
          formulae: [new Date('1990-01-01')],
          showErrorMessage: true,
          errorTitle: 'Invalid date',
          error: 'Enter a valid date (YYYY-MM-DD or use Excel date picker).',
        });
        break;
      }
      case 'text':
      case 'multi-lookup':
      default:
        break;
    }
  });

  sectionRow.height = 22;
  headerRow.height = 36;
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: COLUMNS.length } };
}

/* ============================================================
 * Main
 * ============================================================ */

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const outputDir = resolve(here, '..', '..', 'templates');
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
  const outputPath = resolve(outputDir, 'BUIDCO_Input_Sheet_Template.xlsx');

  process.stdout.write('Loading lookups from DB…\n');
  const lookups = await loadLookups();
  process.stdout.write(
    `  ${lookups.districts.length} districts · ${lookups.sectors.length} sectors · ${lookups.schemes.length} schemes\n`,
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = 'BUIDCO Dashboard';
  wb.created = new Date();
  wb.title = 'BUIDCO Input Sheet Template';

  addReadmeSheet(wb);
  addProjectsSheet(wb, lookups);
  addReferenceSheet(wb, 'Districts', lookups.districts);
  addReferenceSheet(wb, 'Sectors', lookups.sectors);
  addReferenceSheet(wb, 'Schemes', lookups.schemes);
  addEnumsSheet(wb);

  await wb.xlsx.writeFile(outputPath);
  process.stdout.write(`\nWrote ${outputPath}\n`);
  process.stdout.write(`  ${COLUMNS.length} project fields across ${new Set(COLUMNS.map((c) => c.section)).size} sections\n`);
}

main()
  .catch((err: unknown) => {
    process.stderr.write(`Template generation failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
