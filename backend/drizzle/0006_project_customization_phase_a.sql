-- Phase A of the "Project Customization Requirements" spec.
-- All destructive changes deferred; this migration is additive-only:
--
--   §2  Rename Project Status → Execution Status:  label-only, no DB change
--                                                   (column stays `status`).
--   §3.1 Add Contract Type dropdown             →  new column contract_type.
--   §3.2 Add Project Stage dropdown (new options) → new column project_stage_v2.
--                                                   Existing current_phase values
--                                                   are backfilled into it with
--                                                   spelling normalisation
--                                                   (Conceptualization → Conceptualisation).
--   §4.1 Add Revised AA Amount                  →  new column revised_aa_amount_cr.
--   §4.2 Sanctioned Cost auto-populate          →  frontend concern (read-only display),
--                                                   no DB change.
--
-- Soft-removed fields (project_stage, work_type, current_phase) keep their
-- columns intact — the UI just stops showing/writing them. Existing data
-- is preserved and reversible.

ALTER TABLE project
  ADD COLUMN contract_type VARCHAR(20)
    CHECK (contract_type IN
      ('Work Contract','Service Contract','O&M Contract','Others'));

ALTER TABLE project
  ADD COLUMN revised_aa_amount_cr NUMERIC(12,2);

ALTER TABLE project
  ADD COLUMN project_stage_v2 VARCHAR(20)
    CHECK (project_stage_v2 IN
      ('Conceptualisation','Design','Pre-Tender','Tender','Construction','O&M','Other'));

-- Backfill: current_phase → project_stage_v2 with spelling normalisation.
-- 'Completed' has no direct equivalent in the new enum, so it's left NULL
-- (matches "Yes — new Project Stage replaces Current Phase; migrate existing values"
--  answered during spec review).
UPDATE project
SET project_stage_v2 = CASE current_phase
  WHEN 'Conceptualization' THEN 'Conceptualisation'
  WHEN 'Design'            THEN 'Design'
  WHEN 'Pre-Tender'        THEN 'Pre-Tender'
  WHEN 'Tender'            THEN 'Tender'
  WHEN 'Construction'      THEN 'Construction'
  WHEN 'O&M'               THEN 'O&M'
  ELSE NULL
END
WHERE current_phase IS NOT NULL;

CREATE INDEX idx_project_stage_v2 ON project(project_stage_v2)
  WHERE project_stage_v2 IS NOT NULL;

CREATE INDEX idx_project_contract_type ON project(contract_type)
  WHERE contract_type IS NOT NULL;
