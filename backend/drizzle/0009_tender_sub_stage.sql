-- Tender Dashboard Module (Tendor_Dashboard.md §1, §2, §9)
--
-- Adds tender_sub_stage to project so a Tender-stage project always tracks
-- exactly one of the 8 canonical workflow steps. Backfills existing Tender
-- rows to the first sub-stage so nothing appears in the Tender Dashboard
-- with a NULL bucket. Additive-only; existing rows outside the Tender stage
-- are untouched and the column stays nullable so non-tender projects hold NULL.
--
-- Statement order matters: the coupling CHECK is added AFTER the backfill
-- so the constraint validates against consistent data. If we added the
-- constraint first, any existing Tender-stage row (which still has NULL
-- sub-stage at that instant) would fail the check and abort the migration.

ALTER TABLE project
  ADD COLUMN tender_sub_stage VARCHAR(30)
    CHECK (tender_sub_stage IN (
      'NIT Published',
      'Bid Submission (Open)',
      'Technical Evaluation',
      'Financial Evaluation',
      'Approval Process',
      'LoA Issued',
      'Agreement Signing',
      'Work Order Issued'
    ));

-- Backfill: every existing Tender-stage project starts at NIT Published.
-- Matches the auto-assign rule for new projects (Tendor_Dashboard.md §2).
UPDATE project
   SET tender_sub_stage = 'NIT Published'
 WHERE project_stage_v2 = 'Tender'
   AND tender_sub_stage IS NULL;

-- Enforce the coupling at the row level: a Tender-stage project MUST have
-- a sub-stage; a non-Tender project MUST NOT. Keeps the API-side rule from
-- being bypassed by a rogue SQL client.
ALTER TABLE project
  ADD CONSTRAINT project_tender_sub_stage_coupling
  CHECK (
    (project_stage_v2 =  'Tender' AND tender_sub_stage IS NOT NULL) OR
    (project_stage_v2 IS DISTINCT FROM 'Tender' AND tender_sub_stage IS NULL)
  );

-- Partial index — the Tender Dashboard filters exclusively on this column
-- when populating KPI cards. Excluding NULLs keeps the index small.
CREATE INDEX idx_project_tender_sub_stage
  ON project (tender_sub_stage)
 WHERE tender_sub_stage IS NOT NULL;
