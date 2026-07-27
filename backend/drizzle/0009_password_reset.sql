-- ============================================================
-- 0009_password_reset.sql — Forgot Password (OTP) support
--
-- Adds optional contact info to app_user (needed to deliver an OTP) and
-- a password_reset_otp table modeled on refresh_token's hash-and-expire
-- pattern: the raw OTP is never stored, only a bcrypt hash; a second,
-- short-lived "reset token" secret is minted (and hashed the same way)
-- once OTP verification succeeds, so /auth/reset-password can trust the
-- client without re-sending the OTP or issuing a stateless JWT purpose.
-- ============================================================

ALTER TABLE app_user ADD COLUMN email varchar(120);
ALTER TABLE app_user ADD COLUMN mobile_number varchar(15);

CREATE TABLE password_reset_otp (
  otp_id                  SERIAL PRIMARY KEY,
  user_id                 INT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  channel                 VARCHAR(10) NOT NULL,
  otp_hash                TEXT NOT NULL,
  expires_at              TIMESTAMPTZ NOT NULL,
  attempts                INT NOT NULL DEFAULT 0,
  consumed_at             TIMESTAMPTZ,
  reset_token_hash        TEXT,
  reset_token_expires_at  TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent              TEXT,
  ip_address              INET
);

CREATE INDEX idx_password_reset_otp_user   ON password_reset_otp(user_id);
CREATE INDEX idx_password_reset_otp_active ON password_reset_otp(user_id, channel) WHERE consumed_at IS NULL;
