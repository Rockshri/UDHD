/**
 * Shared Zod schemas for `project` writes.
 *
 * - Numeric fields are `number | null` on the wire and get transformed
 *   to strings before Drizzle sees them, because drizzle's `numeric`
 *   column type expects strings (to avoid IEEE 754 loss).
 * - Date fields expect `YYYY-MM-DD`.
 * - Enum-constrained varchars are validated against the enum arrays in
 *   src/db/enums.ts so a bad status/priority is a 400 at the API edge,
 *   not a 500 from Postgres.
 */

import { z } from 'zod';
import {
  currentPhases,
  omStatusOverrides,
  priorities,
  projectStages,
  projectStatuses,
  workTypes,
} from '../db/enums.js';

const numericField = () =>
  z
    .number()
    .finite()
    .nullable()
    .optional()
    .transform((v) => (typeof v === 'number' ? String(v) : v));

const percentField = () =>
  z
    .number()
    .finite()
    .min(0)
    .max(100)
    .nullable()
    .optional()
    .transform((v) => (typeof v === 'number' ? String(v) : v));

const dateField = () =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .nullable()
    .optional();

const stringField = (max: number) => z.string().min(1).max(max).nullable().optional();
const textField = () => z.string().min(1).max(20_000).nullable().optional();

export const createProjectSchema = z.object({
  projectName: z.string().min(1).max(300),

  sectorId: z.number().int().positive().nullable().optional(),
  city: stringField(100),
  districtId: z.number().int().positive().nullable().optional(),
  contractor: stringField(200),
  pd: stringField(120),
  mainWork: textField(),
  physicalWorkProgressNote: textField(),
  projectStage: z.enum(projectStages).nullable().optional(),
  workType: z.enum(workTypes).nullable().optional(),
  sponsoringDept: stringField(150),
  implementingAgency: stringField(150),
  sanctionDate: dateField(),
  projectBrief: textField(),

  currentPhase: z.enum(currentPhases).nullable().optional(),
  status: z.enum(projectStatuses).default('Not Started'),
  plannedEndDate: dateField(),
  revisedEndDate: dateField(),
  delayReason: textField(),
  deptStuckAt: stringField(150),
  expectedCompletionDate: dateField(),
  expectedCompletionRaw: textField(),

  priority: z.enum(priorities).nullable().optional(),
  sanctionedCostCr: numericField(),
  aaAmountCr: numericField(),
  agreementAmountCr: numericField(),
  physicalProgressPct: percentField(),
  financialProgressCr: numericField(),
  financialProgressPct: percentField(),
  scheduledProgressPct: percentField(),

  agreementNumber: stringField(80),
  agreementDate: dateField(),
  appointedDate: dateField(),
  contractValueCr: numericField(),
  mobAdvanceIssuedCr: numericField(),
  mobAdvanceRecoveredCr: numericField(),
  advanceOutstandingCr: numericField(),
  retentionMoneyHeldCr: numericField(),
  pbgNumber: stringField(80),
  pbgAmountCr: numericField(),
  pbgExpiryDate: dateField(),
  pbgIssuingBank: stringField(120),
  emdAmountCr: numericField(),
  emdRefNumber: stringField(80),
  emdDate: dateField(),
  totalPaymentsCr: numericField(),
  lastPaymentDate: dateField(),
  lastRaBillNo: stringField(60),

  geoTaggingUrl: z.string().url().nullable().optional(),

  remark: textField(),

  omApplicable: z.boolean().optional(),
  omStartDate: dateField(),
  omPeriodMonths: numericField(),
  omEndDate: dateField(),
  omAgency: stringField(150),
  omStatusOverride: z.enum(omStatusOverrides).nullable().optional(),
  omRemarks: textField(),

  mprMonth: stringField(20),
  fundReceivedCr: numericField(),
  expenditureCentralRaw: textField(),
  expenditureStateRaw: textField(),
  manpowerEngagedRaw: textField(),
  mainComponentScope: textField(),
  progressPrevMonthRaw: textField(),
  progressThisMonthRaw: textField(),
  mprRemark: textField(),

  schemes: z.array(z.number().int().positive()).max(20).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema.partial();
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
