-- ============================================================================
-- 045_push_devices_email_log.sql — Push cihaz kayıtları + e-posta gönderim logu
-- ----------------------------------------------------------------------------
-- push_devices: /v1/push/register-device ile kaydedilen Web Push / FCM / APN
--   cihaz abonelikleri. endpoint UNIQUE — aynı tarayıcı aboneliği yeniden
--   kayıt olduğunda upsert (ON CONFLICT (endpoint) DO UPDATE) yapılır.
--   Soft-delete: unregister/gone(404|410) durumunda active=false.
--
-- email_log: /v1/email/send üzerinden yapılan HER gönderim denemesinin
--   (sent/failed) denetim kaydı. GET /v1/email/log (admin) buradan okur.
-- ============================================================================

CREATE TABLE push_devices (
  id            TEXT PRIMARY KEY,
  user_id       TEXT,
  username      TEXT NOT NULL,
  platform      TEXT NOT NULL DEFAULT 'web' CHECK (platform IN ('web', 'ios', 'android')),
  provider      TEXT NOT NULL CHECK (provider IN ('web_push', 'fcm', 'apn')),
  endpoint      TEXT NOT NULL UNIQUE,
  keys          JSONB,                          -- web_push: { p256dh, auth }
  user_agent    TEXT,
  bundle_id     TEXT,                           -- apn: iOS bundle id
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  active        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_push_devices_username ON push_devices (username);
CREATE INDEX idx_push_devices_username_provider_active
  ON push_devices (username, provider) WHERE active;

CREATE TABLE email_log (
  id                TEXT PRIMARY KEY,
  to_address        TEXT NOT NULL,
  subject           TEXT,
  status            TEXT CHECK (status IN ('sent', 'failed')),
  provider          TEXT,                       -- 'smtp' vb.
  message_id        TEXT,                       -- SMTP sunucusunun döndürdüğü Message-ID
  error             TEXT,
  kind              TEXT,                       -- meta.kind ('test', 'request_approved'...)
  recipient_user_id TEXT,
  notification_id   TEXT,
  sender_user_id    TEXT,                       -- gönderen (auth) kullanıcı
  meta              JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_log_created_at ON email_log (created_at DESC);
CREATE INDEX idx_email_log_recipient ON email_log (recipient_user_id);
