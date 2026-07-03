-- ============================================================================
-- 041_hr_employee_documents.sql — Özlük Belge Yönetimi (Faz: özlük dosya yükleme)
-- ----------------------------------------------------------------------------
-- Çalışan özlük sekmelerinden yüklenen belgeler (sözleşme, diploma, sertifika,
-- mahkeme/disiplin evrakı, kimlik kopyası...). Dosya içeriği PG'de BYTEA olarak
-- saklanır — tek sunuculu Docker kurulumunda ayrı hacim/S3 gerektirmez,
-- DB yedeğiyle birlikte gider. app-state blob'una base64 GÖMÜLMEZ (kota koruması).
--
-- employee_ref: frontend app-state blob'undaki çalışan id'si (örn "emp_...").
--   SOFT reference — employees tablosuna FK YOK (özlük UI blob ile çalışır).
-- category: hangi özlük sekmesi (contract | education | certificate | court |
--   discipline | identity | other) — serbest metin, uygulama tarafında kısıtlı.
--
-- companies (002), users yeniden kullanılır. Idempotent (IF NOT EXISTS).
-- ============================================================================

CREATE TABLE IF NOT EXISTS hr_employee_documents (
  id           BIGSERIAL PRIMARY KEY,
  company_id   INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_ref VARCHAR(64)  NOT NULL,          -- blob çalışan id'si (soft ref)
  category     VARCHAR(40)  NOT NULL DEFAULT 'other',
  file_name    VARCHAR(300) NOT NULL,
  mime_type    VARCHAR(150),
  size_bytes   INT NOT NULL DEFAULT 0,
  note         TEXT,
  content      BYTEA NOT NULL,                 -- dosya içeriği
  uploaded_by  INT REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bir çalışanın belgelerini kategori bazında hızlı listeleme
CREATE INDEX IF NOT EXISTS idx_hr_emp_docs_lookup
  ON hr_employee_documents (company_id, employee_ref, category);
