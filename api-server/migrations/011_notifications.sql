-- ============================================================================
-- 011_notifications.sql — Bildirimler (Faz 1: Notifications modülü)
-- ----------------------------------------------------------------------------
-- modules/notifications/ TS modülünün persistence katmanı.
-- 007_archives_notifications.sql'daki notification_settings (per-company
-- konfigürasyon) tablosundan AYRI — bu, asıl bildirim kayıtlarının olduğu
-- tablodur.
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id                 TEXT PRIMARY KEY,
  recipient_user_id  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind               JSONB NOT NULL,
  title              TEXT NOT NULL,
  body               TEXT NOT NULL,
  link               TEXT,
  created_by         TEXT NOT NULL DEFAULT 'system',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at            TIMESTAMPTZ,

  CONSTRAINT title_not_empty CHECK (length(trim(title)) > 0),
  CONSTRAINT recipient_positive CHECK (recipient_user_id > 0)
);

-- Bir kullanıcının bildirim feed'i (en yeni önce)
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_recent
  ON notifications(recipient_user_id, created_at DESC);

-- Okunmamış bildirim sayısı badge için (partial index — daha hızlı)
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(recipient_user_id)
  WHERE read_at IS NULL;

-- Kind alanına göre arama (filtreleme/analytics için)
CREATE INDEX IF NOT EXISTS idx_notifications_kind_gin
  ON notifications USING GIN(kind);

COMMENT ON TABLE notifications IS
  'Faz 1: gerçek bildirim kayıtları (notification_settings ile karıştırma).';
COMMENT ON COLUMN notifications.kind IS
  'Discriminated union: { kind: "task_due_soon", taskIds: string[], daysUntilDue: number } gibi';
COMMENT ON COLUMN notifications.created_by IS
  '"system" (cron) veya kullanıcı adı/ID';
