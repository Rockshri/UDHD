-- 6.6a — Fine-grained project permissions on app_user + creator link.
--
-- MD role bypasses these flags at the middleware layer (always allowed),
-- so we initialize MDs to TRUE for symmetry and admins to TRUE to
-- preserve existing behavior. Viewers keep the safe FALSE default.

ALTER TABLE app_user
  ADD COLUMN can_create_projects BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN can_update_projects BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN can_delete_projects BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN created_by          INT REFERENCES app_user(user_id) ON DELETE SET NULL;

-- Backfill: existing MDs and Admins keep their current CRUD abilities.
UPDATE app_user
   SET can_create_projects = TRUE,
       can_update_projects = TRUE,
       can_delete_projects = TRUE
 WHERE role IN ('MD','Admin');

CREATE INDEX idx_app_user_created_by ON app_user(created_by);
