-- Standalone management actions — cross-project topics that don't belong
-- to a specific project row. Complements management_action_item (which
-- stays scoped to a project via Input Sheet §07).
--
-- Kept in its own table so per-project queries and audit trails don't
-- have to reason about NULL project_ids, and so the drop of a project
-- never cascades a standalone topic away.

CREATE TABLE IF NOT EXISTS standalone_management_action (
  action_id      SERIAL PRIMARY KEY,
  topic          TEXT NOT NULL,
  status         VARCHAR(10) NOT NULL DEFAULT 'Open',
  deadline_date  DATE,
  created_by     INTEGER REFERENCES app_user(user_id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_standalone_mgmt_action_status
  ON standalone_management_action (status);
