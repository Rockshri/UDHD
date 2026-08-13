-- Tender Sub-Stage Remark (Tender Dashboard & Division Section Enhancements.md §1)
--
-- Single project-scoped free-text remark that explains why the project is
-- stuck at its current tender_sub_stage. Overwritten (per user decision)
-- whenever the project moves to a different sub-stage — we do not maintain
-- per-stage history for now. A non-empty value BLOCKS the tender-transfer
-- flow (frontend + backend) so the user has to clear the remark to move on.
--
-- Additive-only migration. Column is nullable so existing rows sit at NULL
-- and no backfill is needed.

ALTER TABLE project
  ADD COLUMN tender_remark TEXT;
