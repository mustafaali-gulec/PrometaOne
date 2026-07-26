-- ============================================================================
-- 050_task_attachments.sql — Görev Ekleri (belge yükleme backend'i)
-- ----------------------------------------------------------------------------
-- Görevlere (Satış CRM görevleri + genel Görevler modülü) yüklenen belgeler.
-- Dosya içeriği PG'de BYTEA olarak saklanır — app-state blob'una base64 GÖMÜLMEZ
-- (kota/şişme koruması); DB yedeğiyle birlikte gider, ayrı hacim/S3 gerekmez.
--
-- task_ref: frontend app-state blob'undaki görev id'si (örn "task_...").
--   SOFT reference — tasks tablosu yok (görevler blob'da yaşar), bu yüzden FK YOK.
--
-- companies (002), users yeniden kullanılır. Idempotent (IF NOT EXISTS).
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_attachments (
  id           BIGSERIAL PRIMARY KEY,
  company_id   INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  task_ref     VARCHAR(64)  NOT NULL,          -- blob görev id'si (soft ref)
  file_name    VARCHAR(300) NOT NULL,
  mime_type    VARCHAR(150),
  size_bytes   INT NOT NULL DEFAULT 0,
  note         TEXT,
  content      BYTEA NOT NULL,                 -- dosya içeriği
  uploaded_by  INT REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bir görevin eklerini hızlı listeleme
CREATE INDEX IF NOT EXISTS idx_task_attachments_lookup
  ON task_attachments (company_id, task_ref);
