-- Phase C1 — Introduce the Project Director (PD) role (Read2.md).
--
-- Additive-only:
--   1. Add 'PD' to app_user.role CHECK constraint (MD + Admin + Viewer stay).
--   2. Add can_view_projects flag (defaults TRUE so nothing regresses for
--      existing MD/Admin/Viewer accounts).
--   3. Create user_division junction table (a PD may be assigned one or
--      more divisions; enforced application-side that PDs must have ≥ 1).
--   4. Add selected_division_id to refresh_token so a PD's active-session
--      division survives silent token refreshes without asking them to
--      pick again mid-session.

-- ── 1. Expand role enum ─────────────────────────────────────────────────
-- Anonymous CHECKs in PG are auto-named `<table>_<col>_check`.
ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_role_check;
ALTER TABLE app_user
  ADD CONSTRAINT app_user_role_check
  CHECK (role IN ('MD', 'Admin', 'PD', 'Viewer'));

-- ── 2. can_view_projects flag ───────────────────────────────────────────
-- Default TRUE keeps every existing account in their current state.
ALTER TABLE app_user
  ADD COLUMN can_view_projects BOOLEAN NOT NULL DEFAULT TRUE;

-- ── 3. user_division junction ───────────────────────────────────────────
CREATE TABLE user_division (
  user_id     INT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  division_id INT NOT NULL REFERENCES division(division_id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, division_id)
);
CREATE INDEX idx_user_division_user     ON user_division(user_id);
CREATE INDEX idx_user_division_division ON user_division(division_id);

-- ── 4. Session's selected division on refresh_token ─────────────────────
-- Only populated when the session holder is a PD; NULL for MD/Admin/Viewer.
ALTER TABLE refresh_token
  ADD COLUMN selected_division_id INT REFERENCES division(division_id);
