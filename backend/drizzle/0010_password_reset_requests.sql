-- ============================================================
-- 0010_password_reset_requests.sql — hierarchical password reset approval
--
-- Admin/PD/Viewer can no longer self-serve a password reset OTP; they
-- submit a request here that an authorised higher role must approve
-- before an OTP is generated (see passwordResetService.sendOtp's role
-- guard). Modeled on refresh_token's active-row pattern: a partial
-- unique index enforces "only one active (Pending/Approved) request
-- per user at a time" at the DB level.
-- ============================================================

CREATE TABLE password_reset_request (
  request_id     SERIAL PRIMARY KEY,
  user_id        INT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  role           VARCHAR(10) NOT NULL,
  channel        VARCHAR(10) NOT NULL,
  status         VARCHAR(10) NOT NULL DEFAULT 'Pending',
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  approver_id    INT REFERENCES app_user(user_id),
  approver_role  VARCHAR(10),
  decided_at     TIMESTAMPTZ,
  decision_note  TEXT,
  fulfilled_at   TIMESTAMPTZ,
  user_agent     TEXT,
  ip_address     INET
);

CREATE INDEX idx_password_reset_request_user ON password_reset_request(user_id);
CREATE INDEX idx_password_reset_request_role_status ON password_reset_request(role, status);
CREATE UNIQUE INDEX idx_password_reset_request_active ON password_reset_request(user_id) WHERE status IN ('Pending', 'Approved');
