/**
 * SSoT for the "1 BUIDCO_Input_Sheet_Fillable.xlsx" template contract.
 *
 * Both import (parse + validate) and export (build the workbook) read
 * from this file so column order, headers, styling, dropdowns, and
 * auto-formulas can never drift between the two directions.
 *
 * Reference file: `buidco-dashboard/1 BUIDCO_Input_Sheet_Fillable.xlsx`.
 * All numeric values below (colors, widths, formulas, list values) were
 * extracted verbatim from that workbook via ExcelJS reads.
 */

// ─── Sheet names (must match reference workbook exactly) ──────────────────
export const PROJECT_REGISTER_SHEET = 'Project Register';
export const LISTS_SHEET             = 'Lists';
export const GEO_PHOTOS_SHEET        = 'GeoTagging Photos Log';
export const COS_EOT_SHEET           = 'CoS-EoT Log';
export const MGMT_ACTIONS_SHEET      = 'Management Actions Log';

/** Column headers for each child sheet (in reference order). */
export const SUBSHEET_HEADERS = {
  [GEO_PHOTOS_SHEET]: ['Project Name', 'Photo URL / Link', 'Caption', 'Date Added'],
  [COS_EOT_SHEET]: [
    'Project Name', 'CoS Number', 'CoS Date', 'Category', 'CoS Amount (Rs. Cr.)',
    'Variation %', 'EoT Number', 'EoT Days Granted', 'Time Linked?',
    'Original End Date', 'New End Date (After EoT)', 'Revised Date (if Different)',
  ],
  [MGMT_ACTIONS_SHEET]: ['Project Name', 'Topic', 'Status', 'Deadline Date'],
} as const;

// ─── Section labels (Project Register row 1) ──────────────────────────────
export const SECTIONS = {
  BASIC_INFO:            '01 · Basic Info',
  PHASE_STATUS_DATES:    '02 · Phase, Status & Dates',
  PROGRESS_FINANCIAL:    '03 · Progress & Financial',
  CONTRACT_SECURITY:     '05 · Contract & Financial Security', // template skips "04"
  GEO_TAGGING:           '06 · GeoTagging',
  ACTION_REMARKS:        '07 · Action & Remarks',
  OM_DETAILS:            '08 · O&M Details (Completed projects)',
} as const;
export type SectionLabel = (typeof SECTIONS)[keyof typeof SECTIONS];

// ─── Fill colors (fg + bg pairs — matches reference byte-for-byte) ────────
export interface FillPair { fg: string; bg: string }

export const SECTION_FILL: Record<SectionLabel, FillPair> = {
  [SECTIONS.BASIC_INFO]:         { fg: 'FF1E3A5F', bg: 'FF333333' }, // navy
  [SECTIONS.PHASE_STATUS_DATES]: { fg: 'FF2563EB', bg: 'FF0066CC' }, // blue
  [SECTIONS.PROGRESS_FINANCIAL]: { fg: 'FF059669', bg: 'FF0891B2' }, // green
  [SECTIONS.CONTRACT_SECURITY]:  { fg: 'FF92400E', bg: 'FFB91C1C' }, // amber
  [SECTIONS.GEO_TAGGING]:        { fg: 'FF7C3AED', bg: 'FF333399' }, // purple
  [SECTIONS.ACTION_REMARKS]:     { fg: 'FFB91C1C', bg: 'FF92400E' }, // red
  [SECTIONS.OM_DETAILS]:         { fg: 'FF0891B2', bg: 'FF059669' }, // cyan
};

export const ROW_NUMBER_HEADER_FILL: FillPair = { fg: 'FF111827', bg: 'FF000000' };
export const HEADER_TINT_FILL:       FillPair = { fg: 'FFDCE6F1', bg: 'FFD1D5DB' };
export const DATA_CELL_FILL:         FillPair = { fg: 'FFFFFDE7', bg: 'FFFFFFFF' };
/** Distinct pale-blue for read-only Auto (formula) cells. */
export const AUTO_CELL_FILL:         FillPair = { fg: 'FFEFF6FF', bg: 'FFFFFFFF' };

export const BORDER_ARGB       = 'FFD1D5DB';
export const HEADER_TEXT_ARGB  = 'FF1E3A5F';
export const TYPE_HINT_TEXT_ARGB = 'FF6B7280';

// ─── Row heights + freeze pane + numFmts ──────────────────────────────────
export const ROW_HEIGHTS = {
  SECTION_HEADER: 43.8,
  COLUMN_HEADER:  33.75,
  TYPE_HINT:      12.75,
  DATA:           15,
} as const;

export const FREEZE_X_SPLIT = 2;
export const FREEZE_Y_SPLIT = 3;

export const DATE_NUMFMT   = 'dd-mmm-yyyy';
export const NUMBER_NUMFMT = '#,##0.00';

// ─── Column widths (verbatim from reference) ──────────────────────────────
export const COLUMN_WIDTHS: Record<number, number> = {
   1: 5,   2: 16,  3: 14,  4: 14,  5: 14,  6: 14,  7: 14,  8: 14,  9: 14, 10: 21,
  11: 14, 12: 26, 13: 17, 14: 25, 15: 23, 16: 25, 17: 17, 18: 17, 19: 20, 20: 17,
  21: 24, 22: 20, 23: 20, 24: 26, 25: 26, 26: 26, 27: 26, 28: 26, 29: 24, 30: 26,
  31: 25, 32: 23, 33: 26, 34: 26, 35: 26, 36: 26, 37: 20, 38: 18, 39: 18, 40: 26,
  41: 26, 42: 26, 43: 14, 44: 24, 45: 19, 46: 20, 47: 24, 48: 24, 49: 14, 50: 26,
  51: 21, 52: 20, 53: 26, 54: 37.109375, 55: 14, 56: 20, 57: 16, 58: 18, 59: 18,
  60: 26, 61: 26, 62: 26, 63: 26, 64: 15,
};

// ─── Column definitions for Project Register (all 64 cols) ────────────────
export type DataType = 'Text' | 'Text (long)' | 'Dropdown' | 'Date' | 'Number' | 'Auto';

export interface ColumnDef {
  index: number;               // 1-based
  letter: string;              // e.g. 'B', 'AA'
  section: SectionLabel | null;
  header: string;
  dataType: DataType;
  /** Non-null for Dropdown cols; names a list in LIST_VALUES. */
  dropdown?: keyof typeof LIST_VALUES;
  /** DB field on `project` — null for Auto cols and the row-# col. */
  dbField: string | null;
}

export const PROJECT_REGISTER_COLUMNS: readonly ColumnDef[] = [
  { index: 1,  letter: 'A',  section: null,                             header: '#',                                dataType: 'Auto',        dbField: null },
  // ─── 01 · Basic Info (B..Q) ──────────────────────────
  { index: 2,  letter: 'B',  section: SECTIONS.BASIC_INFO,              header: 'Project Name',                     dataType: 'Text',        dbField: 'projectName' },
  { index: 3,  letter: 'C',  section: SECTIONS.BASIC_INFO,              header: 'Sector',                           dataType: 'Dropdown',    dropdown: 'Sector',       dbField: 'sectorId' },
  { index: 4,  letter: 'D',  section: SECTIONS.BASIC_INFO,              header: 'Scheme(s)',                        dataType: 'Text',        dbField: 'schemes' },
  { index: 5,  letter: 'E',  section: SECTIONS.BASIC_INFO,              header: 'City',                             dataType: 'Text',        dbField: 'city' },
  { index: 6,  letter: 'F',  section: SECTIONS.BASIC_INFO,              header: 'Division',                         dataType: 'Dropdown',    dropdown: 'Division',     dbField: 'divisionId' },
  { index: 7,  letter: 'G',  section: SECTIONS.BASIC_INFO,              header: 'Region',                           dataType: 'Auto',        dbField: null },
  { index: 8,  letter: 'H',  section: SECTIONS.BASIC_INFO,              header: 'Contractor',                       dataType: 'Text',        dbField: 'contractor' },
  { index: 9,  letter: 'I',  section: SECTIONS.BASIC_INFO,              header: 'PD',                               dataType: 'Text',        dbField: 'pd' },
  { index: 10, letter: 'J',  section: SECTIONS.BASIC_INFO,              header: 'Scheme / Category',                dataType: 'Auto',        dbField: null },
  { index: 11, letter: 'K',  section: SECTIONS.BASIC_INFO,              header: 'Main Work',                        dataType: 'Text',        dbField: 'mainWork' },
  { index: 12, letter: 'L',  section: SECTIONS.BASIC_INFO,              header: 'Physical Work Progress',           dataType: 'Text',        dbField: 'physicalWorkProgressNote' },
  { index: 13, letter: 'M',  section: SECTIONS.BASIC_INFO,              header: 'Contract Type',                    dataType: 'Dropdown',    dropdown: 'ContractType', dbField: 'contractType' },
  { index: 14, letter: 'N',  section: SECTIONS.BASIC_INFO,              header: 'Sponsoring Department',            dataType: 'Text',        dbField: 'sponsoringDept' },
  { index: 15, letter: 'O',  section: SECTIONS.BASIC_INFO,              header: 'Implementing Agency',              dataType: 'Text',        dbField: 'implementingAgency' },
  { index: 16, letter: 'P',  section: SECTIONS.BASIC_INFO,              header: 'Project Sanction Date',            dataType: 'Date',        dbField: 'sanctionDate' },
  { index: 17, letter: 'Q',  section: SECTIONS.BASIC_INFO,              header: 'Project Brief',                    dataType: 'Text (long)', dbField: 'projectBrief' },
  // ─── 02 · Phase, Status & Dates (R..Z) ───────────────
  { index: 18, letter: 'R',  section: SECTIONS.PHASE_STATUS_DATES,      header: 'Project Stage',                    dataType: 'Dropdown',    dropdown: 'ProjectStage',   dbField: 'projectStageV2' },
  { index: 19, letter: 'S',  section: SECTIONS.PHASE_STATUS_DATES,      header: 'Execution Status',                 dataType: 'Dropdown',    dropdown: 'ExecStatusCode', dbField: 'status' },
  { index: 20, letter: 'T',  section: SECTIONS.PHASE_STATUS_DATES,      header: 'Status (auto)',                    dataType: 'Auto',        dbField: null },
  { index: 21, letter: 'U',  section: SECTIONS.PHASE_STATUS_DATES,      header: 'Pre-Monsoon Critical',             dataType: 'Dropdown',    dropdown: 'YesNo',          dbField: null }, // not on project schema; parsed but not persisted
  { index: 22, letter: 'V',  section: SECTIONS.PHASE_STATUS_DATES,      header: 'Planned End Date',                 dataType: 'Date',        dbField: 'plannedEndDate' },
  { index: 23, letter: 'W',  section: SECTIONS.PHASE_STATUS_DATES,      header: 'Revised End Date',                 dataType: 'Date',        dbField: 'revisedEndDate' },
  { index: 24, letter: 'X',  section: SECTIONS.PHASE_STATUS_DATES,      header: 'Delay Days (auto, simplified)',    dataType: 'Auto',        dbField: null },
  { index: 25, letter: 'Y',  section: SECTIONS.PHASE_STATUS_DATES,      header: 'Delay Reason / Root Cause',        dataType: 'Text',        dbField: 'delayReason' },
  { index: 26, letter: 'Z',  section: SECTIONS.PHASE_STATUS_DATES,      header: 'Department / Agency Stuck At',     dataType: 'Text',        dbField: 'deptStuckAt' },
  // ─── 03 · Progress & Financial (AA..AJ) ──────────────
  { index: 27, letter: 'AA', section: SECTIONS.PROGRESS_FINANCIAL,      header: 'Physical Progress % (Actual)',     dataType: 'Number',      dbField: 'physicalProgressPct' },
  { index: 28, letter: 'AB', section: SECTIONS.PROGRESS_FINANCIAL,      header: 'Physical Progress % (Scheduled)',  dataType: 'Number',      dbField: 'scheduledProgressPct' },
  { index: 29, letter: 'AC', section: SECTIONS.PROGRESS_FINANCIAL,      header: 'Financial Progress %',             dataType: 'Number',      dbField: 'financialProgressPct' },
  { index: 30, letter: 'AD', section: SECTIONS.PROGRESS_FINANCIAL,      header: 'Total CoS Count (auto)',           dataType: 'Auto',        dbField: null },
  { index: 31, letter: 'AE', section: SECTIONS.PROGRESS_FINANCIAL,      header: 'Total EoT Days (auto)',            dataType: 'Auto',        dbField: null },
  { index: 32, letter: 'AF', section: SECTIONS.PROGRESS_FINANCIAL,      header: 'AA Amount (Rs. Cr.)',              dataType: 'Number',      dbField: 'aaAmountCr' },
  { index: 33, letter: 'AG', section: SECTIONS.PROGRESS_FINANCIAL,      header: 'Revised AA Amount (Rs. Cr.)',      dataType: 'Number',      dbField: 'revisedAaAmountCr' },
  { index: 34, letter: 'AH', section: SECTIONS.PROGRESS_FINANCIAL,      header: 'Sanctioned Cost (Rs. Cr., auto)',  dataType: 'Auto',        dbField: null },
  { index: 35, letter: 'AI', section: SECTIONS.PROGRESS_FINANCIAL,      header: 'Agreement Amount (Rs. Cr.)',       dataType: 'Number',      dbField: 'agreementAmountCr' },
  { index: 36, letter: 'AJ', section: SECTIONS.PROGRESS_FINANCIAL,      header: 'Financial Progress (Rs. Cr.)',     dataType: 'Number',      dbField: 'financialProgressCr' },
  // ─── 05 · Contract & Financial Security (AK..BA) ────
  { index: 37, letter: 'AK', section: SECTIONS.CONTRACT_SECURITY,       header: 'Agreement Number',                 dataType: 'Text',        dbField: 'agreementNumber' },
  { index: 38, letter: 'AL', section: SECTIONS.CONTRACT_SECURITY,       header: 'Agreement Date',                   dataType: 'Date',        dbField: 'agreementDate' },
  { index: 39, letter: 'AM', section: SECTIONS.CONTRACT_SECURITY,       header: 'Appointed Date',                   dataType: 'Date',        dbField: 'appointedDate' },
  { index: 40, letter: 'AN', section: SECTIONS.CONTRACT_SECURITY,       header: 'Contract Value (Rs. Cr.)',         dataType: 'Number',      dbField: 'contractValueCr' },
  { index: 41, letter: 'AO', section: SECTIONS.CONTRACT_SECURITY,       header: 'Mobilization Advance \n(Rs. Cr.)', dataType: 'Number',      dbField: 'mobAdvanceIssuedCr' },
  { index: 42, letter: 'AP', section: SECTIONS.CONTRACT_SECURITY,       header: 'Mob. Advance Recovered (Rs. Cr.)', dataType: 'Number',      dbField: 'mobAdvanceRecoveredCr' },
  { index: 43, letter: 'AQ', section: SECTIONS.CONTRACT_SECURITY,       header: 'PBG Number',                       dataType: 'Text',        dbField: 'pbgNumber' },
  { index: 44, letter: 'AR', section: SECTIONS.CONTRACT_SECURITY,       header: 'PBG Amount \n(Rs. Cr.)',           dataType: 'Number',      dbField: 'pbgAmountCr' },
  { index: 45, letter: 'AS', section: SECTIONS.CONTRACT_SECURITY,       header: 'PBG Expiry Date',                  dataType: 'Date',        dbField: 'pbgExpiryDate' },
  { index: 46, letter: 'AT', section: SECTIONS.CONTRACT_SECURITY,       header: 'PBG Issuing Bank',                 dataType: 'Text',        dbField: 'pbgIssuingBank' },
  { index: 47, letter: 'AU', section: SECTIONS.CONTRACT_SECURITY,       header: 'EMD Amount \n(Rs. Cr.)',           dataType: 'Number',      dbField: 'emdAmountCr' },
  { index: 48, letter: 'AV', section: SECTIONS.CONTRACT_SECURITY,       header: 'EMD Reference Number',             dataType: 'Text',        dbField: 'emdRefNumber' },
  { index: 49, letter: 'AW', section: SECTIONS.CONTRACT_SECURITY,       header: 'EMD Date',                         dataType: 'Date',        dbField: 'emdDate' },
  { index: 50, letter: 'AX', section: SECTIONS.CONTRACT_SECURITY,       header: 'Total Payments Made \n(Rs. Cr.)',  dataType: 'Number',      dbField: 'totalPaymentsCr' },
  { index: 51, letter: 'AY', section: SECTIONS.CONTRACT_SECURITY,       header: 'Last Payment Date',                dataType: 'Date',        dbField: 'lastPaymentDate' },
  { index: 52, letter: 'AZ', section: SECTIONS.CONTRACT_SECURITY,       header: 'Last RA Bill No.',                 dataType: 'Text',        dbField: 'lastRaBillNo' },
  { index: 53, letter: 'BA', section: SECTIONS.CONTRACT_SECURITY,       header: 'Retention Money Held \n(Rs. Cr.)', dataType: 'Number',      dbField: 'retentionMoneyHeldCr' },
  // ─── 06 · GeoTagging (BB) ────────────────────────────
  { index: 54, letter: 'BB', section: SECTIONS.GEO_TAGGING,             header: 'Geo-Tagging URL (overview link)',  dataType: 'Text',        dbField: 'geoTaggingUrl' },
  // ─── 07 · Action & Remarks (BC..BE) ──────────────────
  { index: 55, letter: 'BC', section: SECTIONS.ACTION_REMARKS,          header: 'Priority',                         dataType: 'Dropdown',    dropdown: 'Priority',       dbField: 'priority' },
  { index: 56, letter: 'BD', section: SECTIONS.ACTION_REMARKS,          header: 'Outstanding Gap?',                 dataType: 'Dropdown',    dropdown: 'YesNo',          dbField: null }, // no explicit gap boolean; treated as prompt for remark
  { index: 57, letter: 'BE', section: SECTIONS.ACTION_REMARKS,          header: 'Gap / Remark',                     dataType: 'Text (long)', dbField: 'remark' },
  // ─── 08 · O&M Details (BF..BL) ───────────────────────
  { index: 58, letter: 'BF', section: SECTIONS.OM_DETAILS,              header: 'O&M Applicable',                   dataType: 'Dropdown',    dropdown: 'YesNo',          dbField: 'omApplicable' },
  { index: 59, letter: 'BG', section: SECTIONS.OM_DETAILS,              header: 'O&M Start Date',                   dataType: 'Date',        dbField: 'omStartDate' },
  { index: 60, letter: 'BH', section: SECTIONS.OM_DETAILS,              header: 'Total O&M Period \n(Months)',      dataType: 'Number',      dbField: 'omPeriodMonths' },
  { index: 61, letter: 'BI', section: SECTIONS.OM_DETAILS,              header: 'O&M End Date \n(auto, override-able)', dataType: 'Auto',    dbField: 'omEndDate' },
  { index: 62, letter: 'BJ', section: SECTIONS.OM_DETAILS,              header: 'O&M Agency / Contractor',          dataType: 'Text',        dbField: 'omAgency' },
  { index: 63, letter: 'BK', section: SECTIONS.OM_DETAILS,              header: 'O&M Status (Manual Override)',     dataType: 'Dropdown',    dropdown: 'OMStatus',       dbField: 'omStatusOverride' },
  { index: 64, letter: 'BL', section: SECTIONS.OM_DETAILS,              header: 'O&M Remarks',                      dataType: 'Text (long)', dbField: 'omRemarks' },
];

// ─── Dropdown lookup values (verbatim from Lists sheet) ───────────────────
export const LIST_VALUES = {
  Sector:         ['Crematorium', 'Sewerage', 'SWD', 'Water Supply', 'Others'] as const,
  Division: [
    'Arwal', 'Aurangabad', 'Banka', 'Bhagalpur', 'Bhojpur', 'Buxar',
    'Gayaji', 'Jamui', 'Jehanabad', 'Kaimur', 'Lakhisarai', 'Munger',
    'Nalanda', 'Nawada', 'Patna Azimabad', 'Patna Bankipur',
    'Patna Kankarbagh', 'Patna Nutan', 'Patna West', 'Patna Patliputra',
    'Patna East', 'Patna City', 'Rohtas', 'Sheikhpura', 'Araria',
    'Begusarai', 'Darbhanga', 'Gopalganj', 'Katihar', 'Khagaria',
    'Kishanganj', 'Madhepura', 'Madhubani', 'Muzaffarpur',
    'West Champaran (Betiah)', 'East Champaran', 'Purnea', 'Saharsha',
    'Samastipur', 'Saran', 'Sheohar', 'Sitamarahi', 'Siwaan', 'Supaul',
    'Vaishali',
  ] as const,
  ContractType:    ['Works Contract', 'Service Contract', 'O&M Contract', 'Others'] as const,
  ProjectStage:    ['Conceptualization', 'Design', 'Pre-Tender', 'Tender', 'Construction', 'O&M', 'Completed'] as const,
  ExecStatusCode:  ['NOT_STARTED', 'IN_PROGRESS', 'DELAYED', 'ON_HOLD', 'COMPLETED'] as const,
  ExecStatusLabel: ['Not Started', 'In Progress', 'Delayed', 'On Hold', 'Completed'] as const,
  YesNo:           ['Yes', 'No'] as const,
  Priority:        ['High', 'Medium', 'Low', 'N/A'] as const,
  OMStatus:        ['Not Started', 'Ongoing', 'Expiring Soon', 'Expired', 'Handed Over to ULB'] as const,
  CoSCategory:     ['SCOPE ADDITION', 'SCOPE DELETION', 'DESIGN CHANGE', 'QUANTITY VARIATION', 'OTHERS'] as const,
  MgmtStatus:      ['Open', 'Closed'] as const,
  Scheme:          ['Namami Gange', 'AMRUT 1.0', 'AMRUT 2.0', 'SAAT NISHCHAY', 'STATE FUNDED', 'Pragati Yatra', 'Patna Smart City', 'MMSSVY'] as const,
} as const;

/**
 * Ordered [Division, Region] pairs — cols N/O of the Lists sheet. Referenced
 * by the Region auto-formula on the Project Register.
 */
export const DIVISION_REGION_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['Arwal', 'South Bihar'], ['Aurangabad', 'South Bihar'], ['Banka', 'South Bihar'],
  ['Bhagalpur', 'South Bihar'], ['Bhojpur', 'South Bihar'], ['Buxar', 'South Bihar'],
  ['Gayaji', 'South Bihar'], ['Jamui', 'South Bihar'], ['Jehanabad', 'South Bihar'],
  ['Kaimur', 'South Bihar'], ['Lakhisarai', 'South Bihar'], ['Munger', 'South Bihar'],
  ['Nalanda', 'South Bihar'], ['Nawada', 'South Bihar'], ['Patna Azimabad', 'South Bihar'],
  ['Patna Bankipur', 'South Bihar'], ['Patna Kankarbagh', 'South Bihar'],
  ['Patna Nutan', 'South Bihar'], ['Patna West', 'South Bihar'],
  ['Patna Patliputra', 'South Bihar'], ['Patna East', 'South Bihar'],
  ['Patna City', 'South Bihar'], ['Rohtas', 'South Bihar'], ['Sheikhpura', 'South Bihar'],
  ['Araria', 'North Bihar'], ['Begusarai', 'North Bihar'], ['Darbhanga', 'North Bihar'],
  ['Gopalganj', 'North Bihar'], ['Katihar', 'North Bihar'], ['Khagaria', 'North Bihar'],
  ['Kishanganj', 'North Bihar'], ['Madhepura', 'North Bihar'], ['Madhubani', 'North Bihar'],
  ['Muzaffarpur', 'North Bihar'], ['West Champaran (Betiah)', 'North Bihar'],
  ['East Champaran', 'North Bihar'], ['Purnea', 'North Bihar'], ['Saharsha', 'North Bihar'],
  ['Samastipur', 'North Bihar'], ['Saran', 'North Bihar'], ['Sheohar', 'North Bihar'],
  ['Sitamarahi', 'North Bihar'], ['Siwaan', 'North Bihar'], ['Supaul', 'North Bihar'],
  ['Vaishali', 'North Bihar'],
];

// ─── Auto formulas (per column, factory takes row #) ──────────────────────
export const AUTO_FORMULAS: Record<number, (r: number) => string> = {
  7:  (r) => `IFERROR(VLOOKUP(F${r},Lists!$N$2:$O$46,2,FALSE()),"")`,     // Region
  10: (r) => `D${r}`,                                                       // Scheme/Category
  20: (r) => `IFERROR(VLOOKUP(S${r},Lists!$E$2:$F$6,2,FALSE()),"")`,       // Status label
  24: (r) => `IF(OR(V${r}="",S${r}="COMPLETED"),0,MAX(0,TODAY()-V${r}))`,  // Delay Days
  30: (r) => `COUNTIF('CoS-EoT Log'!$A:$A,B${r})`,                          // CoS Count
  31: (r) => `SUMIF('CoS-EoT Log'!$A:$A,B${r},'CoS-EoT Log'!$H:$H)`,        // EoT Days
  34: (r) => `IF(AND(ISNUMBER(AG${r}),AG${r}>0),AG${r},AF${r})`,            // Sanctioned Cost
  61: (r) => `IF(AND(BG${r}<>"",BH${r}<>""),EDATE(BG${r},BH${r}),"")`,      // O&M End Date
};

/** Overrides for Auto-column numFmt (numeric or date formulas). */
export const AUTO_COL_NUMFMT: Record<number, string> = {
  34: NUMBER_NUMFMT,
  61: DATE_NUMFMT,
};

/** Rows 4..35 form a shared-formula block per column (reference workbook
 *  uses this XML optimization for cols 10, 24, 34, 61). Non-shared cols
 *  use plain per-row formulas. */
export const SHARED_FORMULA_END_ROW = 35;
export const SHARED_FORMULA_COLUMNS: ReadonlySet<number> = new Set([10, 24, 34, 61]);

// ─── Enum normalization: template values ↔ DB enum values ────────────────
/**
 * Template calls it "Works Contract" (with 's'); DB enum drops the 's'.
 * Similar spellings differ for ProjectStage + ExecStatus.
 */
export const CONTRACT_TYPE_TEMPLATE_TO_DB: Record<string, string> = {
  'Works Contract':   'Work Contract',
  'Service Contract': 'Service Contract',
  'O&M Contract':     'O&M Contract',
  'Others':           'Others',
};
export const CONTRACT_TYPE_DB_TO_TEMPLATE: Record<string, string> = Object.fromEntries(
  Object.entries(CONTRACT_TYPE_TEMPLATE_TO_DB).map(([t, d]) => [d, t]),
);

/**
 * Template's ProjectStage list uses US spelling ("Conceptualization") +
 * includes "Completed" as a stage. DB `projectStageV2` uses British
 * ("Conceptualisation") + no "Completed" (that's the status column).
 */
export const PROJECT_STAGE_TEMPLATE_TO_DB: Record<string, string> = {
  'Conceptualization': 'Conceptualisation',
  'Design':            'Design',
  'Pre-Tender':        'Pre-Tender',
  'Tender':            'Tender',
  'Construction':      'Construction',
  'O&M':               'O&M',
  'Completed':         'Other', // no direct stage — fold into Other + let status='Completed' carry the state
};
export const PROJECT_STAGE_DB_TO_TEMPLATE: Record<string, string> = {
  'Conceptualisation': 'Conceptualization',
  'Design':            'Design',
  'Pre-Tender':        'Pre-Tender',
  'Tender':            'Tender',
  'Construction':      'Construction',
  'O&M':               'O&M',
  'Other':             'Conceptualization', // reverse best-effort
};

/** Template's exec-status code (NOT_STARTED etc.) ↔ DB's status label ("Not Started"). */
export const EXEC_STATUS_TEMPLATE_TO_DB: Record<string, string> = {
  'NOT_STARTED': 'Not Started',
  'IN_PROGRESS': 'In Progress',
  'DELAYED':     'Delayed',
  'ON_HOLD':     'On Hold',
  'COMPLETED':   'Completed',
};
export const EXEC_STATUS_DB_TO_TEMPLATE: Record<string, string> = Object.fromEntries(
  Object.entries(EXEC_STATUS_TEMPLATE_TO_DB).map(([t, d]) => [d, t]),
);

/** Template's YesNo → boolean. */
export const YES_NO_TO_BOOL: Record<string, boolean> = { Yes: true, No: false };

// ─── Import limits ────────────────────────────────────────────────────────
export const IMPORT_LIMITS = {
  /** Max upload size in bytes (10 MB). */
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  /** Max rows across all sheets combined. */
  MAX_ROWS: 500,
  /** MIME whitelist. */
  ACCEPTED_MIMES: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/octet-stream', // some browsers report generic
  ] as const,
} as const;

/** Presentational-only header shown on the download filename etc. */
export const TEMPLATE_DISPLAY_NAME = 'BUIDCO Input Sheet';
