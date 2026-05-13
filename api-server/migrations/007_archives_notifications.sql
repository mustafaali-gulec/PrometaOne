-- ============================================================================
-- 007_archives_notifications.sql
-- Promet CF — Mali yıl arşivleri ve bildirim ayarları
-- ============================================================================

-- ============================================================================
-- YEAR ARCHIVES
-- Her arşiv: bir mali yılın tam snapshot'ı (cells + categories metadata)
-- Bankalar, kasa, fatura, transfer ARŞİVLENMEZ (continuous timeline)
-- ============================================================================
CREATE TABLE year_archives (
  id                  BIGSERIAL PRIMARY KEY,
  company_id          INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fiscal_year         INT NOT NULL,
  fiscal_start_month  SMALLINT NOT NULL,
  opening_cash        NUMERIC(20, 2) NOT NULL,
  closing_cash        NUMERIC(20, 2) NOT NULL,
  total_inflow        NUMERIC(20, 2) NOT NULL DEFAULT 0,
  total_outflow       NUMERIC(20, 2) NOT NULL DEFAULT 0,
  snapshot            JSONB NOT NULL,                 -- { inflows, outflows, nonPnlOutflows, cells }
  archived_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_by         INT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (company_id, fiscal_year)
);

CREATE INDEX idx_archives_company ON year_archives(company_id, fiscal_year DESC);
CREATE INDEX idx_archives_snapshot_gin ON year_archives USING GIN(snapshot jsonb_path_ops);

-- ============================================================================
-- NOTIFICATION SETTINGS (per-company)
-- ============================================================================
CREATE TABLE notification_settings (
  company_id              INT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  enabled                 BOOLEAN NOT NULL DEFAULT FALSE,
  recipients              TEXT[] NOT NULL DEFAULT '{}',
  alert_threshold_days    INT NOT NULL DEFAULT 7 CHECK (alert_threshold_days BETWEEN 1 AND 30),
  include_overdue         BOOLEAN NOT NULL DEFAULT TRUE,
  include_due_soon        BOOLEAN NOT NULL DEFAULT TRUE,
  include_upcoming_30     BOOLEAN NOT NULL DEFAULT TRUE,
  include_cash_position   BOOLEAN NOT NULL DEFAULT TRUE,
  include_fx_positions    BOOLEAN NOT NULL DEFAULT TRUE,
  cron_schedule           VARCHAR(50) NOT NULL DEFAULT '0 9 * * 1-5',  -- iş günleri 09:00
  last_generated_at       TIMESTAMPTZ,
  last_sent_at            TIMESTAMPTZ,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by              INT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TRIGGER notif_settings_updated_at BEFORE UPDATE ON notification_settings
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ============================================================================
-- NOTIFICATION HISTORY (gönderilen e-mail'lerin kaydı)
-- ============================================================================
CREATE TABLE notification_history (
  id           BIGSERIAL PRIMARY KEY,
  company_id   INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sent_to      TEXT[] NOT NULL,
  subject      TEXT,
  body         TEXT,
  summary      JSONB,                                 -- özet metrikler
  status       VARCHAR(20) NOT NULL DEFAULT 'sent',   -- sent, failed
  error        TEXT,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_history_company ON notification_history(company_id, sent_at DESC);
