-- ============================================================
-- 0002_relax_project_fks.sql
--
-- Two FKs to project(project_id) in the v7 baseline default to
-- ON DELETE NO ACTION, which would block real deletes as soon as
-- an audit or meeting row references the project:
--
--   audit_log.project_id            → intent is that audit rows
--     survive project deletion (project_name_snapshot preserves
--     context) → SET NULL.
--   minutes_of_meeting.project_id   → a MoM record has value even
--     if the linked project is later deleted → SET NULL.
--
-- All other FKs to project already have ON DELETE CASCADE and are
-- untouched.
-- ============================================================

ALTER TABLE audit_log
  DROP CONSTRAINT audit_log_project_id_fkey,
  ADD  CONSTRAINT audit_log_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES project(project_id) ON DELETE SET NULL;

ALTER TABLE minutes_of_meeting
  DROP CONSTRAINT minutes_of_meeting_project_id_fkey,
  ADD  CONSTRAINT minutes_of_meeting_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES project(project_id) ON DELETE SET NULL;
