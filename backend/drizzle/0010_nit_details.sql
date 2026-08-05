-- Tender Dashboard — NIT Details Management (NIT_addition_instructions.md)
--
-- Adds nit_number + nit_date to project. Both nullable — the fields are
-- populated only after a tender project reaches (or is created at) the
-- NIT Published sub-stage and the user submits them from the Tender
-- Dashboard. Non-tender projects (and tender projects that haven't yet
-- entered a value) hold NULL and are rendered client-side as the
-- "Yet to be Published" / "Yet to Declare" placeholders.
--
-- The stage-coupled edit rule ("only editable while sub-stage = NIT
-- Published") and the "cannot advance past NIT Published without both
-- fields set" rule are enforced in the application layer, not by
-- constraints — they'd otherwise block valid legacy data.

ALTER TABLE project
  ADD COLUMN nit_number VARCHAR(80),
  ADD COLUMN nit_date   DATE;

-- Partial index: the Projects Register search box will ILIKE nit_number
-- along with project_name / project_id. Skipping NULLs keeps the index
-- tiny (only tender-stage projects populate this column).
CREATE INDEX idx_project_nit_number
  ON project (nit_number)
 WHERE nit_number IS NOT NULL;
