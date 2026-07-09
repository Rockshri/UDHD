-- ============================================================
-- 0001_refresh_token.sql — stateful refresh-token store
--
-- Each row represents one issued refresh token. The rawToken lives only
-- in the browser cookie; the DB keeps a bcrypt hash. On rotation the old
-- row is marked revoked_at + replaced_by; on logout revoked_at is set.
-- ============================================================

CREATE TABLE refresh_token (
  token_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      INT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL,
  issued_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  replaced_by  UUID REFERENCES refresh_token(token_id) ON DELETE SET NULL,
  user_agent   TEXT,
  ip_address   INET
);

CREATE INDEX idx_refresh_token_user   ON refresh_token(user_id);
CREATE INDEX idx_refresh_token_active ON refresh_token(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_refresh_token_expires ON refresh_token(expires_at) WHERE revoked_at IS NULL;
