-- ============================================================================
-- 036_reporting.sql — Report Studio (Rapor Üreteci / Rapor Stüdyosu)
-- ----------------------------------------------------------------------------
-- modules/reporting/ TS modülünün persistence katmanı.
--
-- Tablolar:
--   report_folders     → Rapor klasör/grup ağacı (opsiyonel hiyerarşi, parent_id)
--   report_definitions → Rapor tanımı (mode: sql | visual) + viz/layout config
--   report_runs        → Çalıştırma denetim kaydı (kim/ne zaman/süre/satır/durum)
--   scheduled_reports  → Zamanlanmış e-posta raporları (FE data.scheduledReports
--                        backend karşılığı; cron P5'te çalıştırır)
--
-- TASARIM KARARI (güvenli SQL yürütme):
--   Ad-hoc / kayıtlı SQL ASLA ana RW pool ile commit edilmez. Her sorgu
--   reportingPool (REPORTING_DATABASE_URL — tercihen salt-okunur ROL) üzerinde,
--   SET LOCAL statement_timeout + idle_in_transaction_session_timeout +
--   SET TRANSACTION READ ONLY ile açılan bir transaction içinde çalışır ve
--   DAİMA ROLLBACK edilir (bkz. infrastructure/sql/SafeSqlExecutor.ts +
--   domain/sql/SqlGuard.ts). report_runs HAM SONUÇ TUTMAZ — sadece metadata
--   (satır sayısı / süre / durum / hata).
--
-- TASARIM KARARI (allowlist katalog):
--   Raporlanabilir tablo/view + kolon allowlist'i KOD'da
--   (domain/catalog/ReportCatalog.ts) tutulur. users / sessions / access_* /
--   password_resets / einvoice kimlik tabloları gibi hassas kaynaklar
--   allowlist'e ALINMAZ.
--
-- companies (002) + trg_updated_at() (001) + users (001) yeniden kullanılır —
-- burada tekrar tanımlanmaz. Tüm tablolar company_id ile multi-tenant izole.
-- ============================================================================


-- ============================================================================
-- ENUM tipleri
-- ============================================================================
CREATE TYPE report_mode          AS ENUM ('sql', 'visual');
CREATE TYPE report_visibility    AS ENUM ('private', 'company', 'public');
CREATE TYPE report_run_status    AS ENUM ('success', 'error', 'timeout', 'blocked');
CREATE TYPE report_schedule_freq AS ENUM ('daily', 'weekly', 'monthly');


-- ============================================================================
-- REPORT_FOLDERS — klasör/grup ağacı (opsiyonel; parent_id ile hiyerarşi)
-- ============================================================================
CREATE TABLE report_folders (
  id          SERIAL PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  parent_id   INT REFERENCES report_folders(id) ON DELETE CASCADE,
  name        VARCHAR(200) NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT report_folders_name_not_empty CHECK (length(trim(name)) > 0)
);

CREATE INDEX idx_report_folders_company ON report_folders(company_id);
CREATE INDEX idx_report_folders_parent  ON report_folders(company_id, parent_id);

CREATE TRIGGER report_folders_updated_at BEFORE UPDATE ON report_folders
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();


-- ============================================================================
-- REPORT_DEFINITIONS — rapor tanımı
--   mode = 'sql'    → sql_text dolu (kayıtta SqlGuard'dan geçer), query_spec NULL
--   mode = 'visual' → query_spec (JSONB) dolu, sql_text derlenmiş hâli (cache)
--   params        = [{ name, type, label, default, required, options? }]
--   viz_config    = grafik/tablo görünüm ayarı (FE yorumlar)
--   layout_config = yazdırılabilir PDF bantlı şablon (FE yorumlar; backend opak)
-- ============================================================================
CREATE TABLE report_definitions (
  id            SERIAL PRIMARY KEY,
  company_id    INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  folder_id     INT REFERENCES report_folders(id) ON DELETE SET NULL,
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  group_label   VARCHAR(120),
  mode          report_mode NOT NULL,
  sql_text      TEXT,
  query_spec    JSONB,
  params        JSONB NOT NULL DEFAULT '[]'::jsonb,
  viz_config    JSONB NOT NULL DEFAULT '{}'::jsonb,
  layout_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  visibility    report_visibility NOT NULL DEFAULT 'private',
  owner_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  created_by    INT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT report_definitions_name_not_empty CHECK (length(trim(name)) > 0),
  -- sql modu → sql_text dolu; visual modu → query_spec dolu
  CONSTRAINT report_definitions_source_shape CHECK (
    (mode = 'sql'    AND sql_text   IS NOT NULL AND length(trim(sql_text)) > 0)
    OR
    (mode = 'visual' AND query_spec IS NOT NULL)
  )
);

CREATE INDEX idx_report_definitions_company        ON report_definitions(company_id);
CREATE INDEX idx_report_definitions_company_folder ON report_definitions(company_id, folder_id);
CREATE INDEX idx_report_definitions_owner          ON report_definitions(company_id, owner_user_id);
CREATE UNIQUE INDEX uq_report_definitions_company_name
  ON report_definitions(company_id, lower(name));

CREATE TRIGGER report_definitions_updated_at BEFORE UPDATE ON report_definitions
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();


-- ============================================================================
-- REPORT_RUNS — çalıştırma denetimi (HAM VERİ SAKLAMAZ — sadece metadata)
--   report_id NULL = ad-hoc (kaydedilmemiş) çalıştırma
--   sql_hash = derlenmiş SQL'in sha256'sı (debug/dedup; ham SQL değil)
--   append-only — updated_at / trigger YOK.
-- ============================================================================
CREATE TABLE report_runs (
  id            BIGSERIAL PRIMARY KEY,
  company_id    INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  report_id     INT REFERENCES report_definitions(id) ON DELETE SET NULL,
  mode          report_mode NOT NULL,
  status        report_run_status NOT NULL,
  row_count     INT,
  duration_ms   INT,
  truncated     BOOLEAN NOT NULL DEFAULT FALSE,
  sql_hash      CHAR(64),
  error_code    VARCHAR(60),
  error_message TEXT,
  run_by        INT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_report_runs_company_created ON report_runs(company_id, created_at DESC);
CREATE INDEX idx_report_runs_company_report  ON report_runs(company_id, report_id);
CREATE INDEX idx_report_runs_status          ON report_runs(company_id, status);


-- ============================================================================
-- SCHEDULED_REPORTS — zamanlanmış e-posta raporları (Faz P5'te cron çalıştırır)
--   FE data.scheduledReports[] şekli:
--     { reportId, frequency, dayOfWeek, dayOfMonth, time, recipients[], format }
-- ============================================================================
CREATE TABLE scheduled_reports (
  id            SERIAL PRIMARY KEY,
  company_id    INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  report_id     INT NOT NULL REFERENCES report_definitions(id) ON DELETE CASCADE,
  frequency     report_schedule_freq NOT NULL,
  day_of_week   INT,
  day_of_month  INT,
  time_of_day   VARCHAR(5) NOT NULL DEFAULT '08:00',
  recipients    TEXT[] NOT NULL DEFAULT '{}',
  param_values  JSONB NOT NULL DEFAULT '{}'::jsonb,
  format        VARCHAR(10) NOT NULL DEFAULT 'xlsx',
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at   TIMESTAMPTZ,
  last_status   report_run_status,
  created_by    INT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT scheduled_reports_dow_range CHECK (day_of_week  IS NULL OR day_of_week  BETWEEN 0 AND 6),
  CONSTRAINT scheduled_reports_dom_range CHECK (day_of_month IS NULL OR day_of_month BETWEEN 1 AND 31),
  CONSTRAINT scheduled_reports_time_fmt  CHECK (time_of_day ~ '^[0-2][0-9]:[0-5][0-9]$')
);

CREATE INDEX idx_scheduled_reports_company        ON scheduled_reports(company_id);
CREATE INDEX idx_scheduled_reports_enabled        ON scheduled_reports(enabled) WHERE enabled = TRUE;
CREATE INDEX idx_scheduled_reports_company_report ON scheduled_reports(company_id, report_id);

CREATE TRIGGER scheduled_reports_updated_at BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();


-- ============================================================================
-- Yorumlar (dökümantasyon)
-- ============================================================================
COMMENT ON TABLE report_definitions IS
  'Report Studio: rapor tanımı (sql|visual). query_spec=görsel JSON, layout_config=PDF bantlı şablon.';
COMMENT ON TABLE report_runs IS
  'Report Studio: çalıştırma denetimi. HAM SONUÇ SAKLANMAZ — sadece satır/süre/durum/hata.';
COMMENT ON TABLE scheduled_reports IS
  'Report Studio: zamanlanmış e-posta raporları (FE data.scheduledReports backend karşılığı).';

-- ============================================================================
-- /036_reporting.sql
-- ============================================================================
