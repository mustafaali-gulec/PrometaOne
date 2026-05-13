-- 010_password_resets.sql
-- Şifre sıfırlama tokenleri için tablo

CREATE TABLE IF NOT EXISTS password_resets (
  id           BIGSERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token        VARCHAR(64) NOT NULL UNIQUE,
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ,
  ip_address   VARCHAR(64),
  user_agent   TEXT,
  email_sent   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user      ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_token     ON password_resets(token);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires   ON password_resets(expires_at)
  WHERE used_at IS NULL;

-- Eski tokenleri temizleme view'i (cron için)
CREATE OR REPLACE VIEW expired_password_resets AS
SELECT id, user_id, token, expires_at
FROM password_resets
WHERE used_at IS NULL AND expires_at < NOW();

COMMENT ON TABLE password_resets IS 'Sifre sifirlama tokenleri (15dk gecerli, tek kullanımlik)';
