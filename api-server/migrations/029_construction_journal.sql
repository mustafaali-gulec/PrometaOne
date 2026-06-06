-- ============================================================================
-- 029_construction_journal.sql
-- Construction-service hakediş event'lerinden ÜRETİLEN yevmiye fişleri.
--
-- Monolit (muhasebenin sahibi) Kafka'dan construction.hakedis/status_changed
-- (approved|paid) alınca çift taraflı (borç/alacak) fiş üretir. Idempotent:
-- (company_id, progress_id, event_status) tekildir → event tekrar gelirse 2.
-- fiş oluşmaz.
-- ============================================================================

CREATE TABLE construction_journal_entries (
  id            BIGSERIAL PRIMARY KEY,
  company_id    INT NOT NULL,
  source        VARCHAR(40) NOT NULL DEFAULT 'construction',
  progress_id   BIGINT NOT NULL,                 -- construction-service hakediş id
  hakedis_no    VARCHAR(40),
  kind          VARCHAR(20),                     -- employer | subcontractor
  event_status  VARCHAR(20),                     -- approved | paid
  description   VARCHAR(500),
  entry_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  total         NUMERIC(20, 2) NOT NULL DEFAULT 0,
  currency      VARCHAR(3) NOT NULL DEFAULT 'TRY',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, progress_id, event_status)
);

CREATE INDEX idx_cje_company ON construction_journal_entries(company_id, entry_date);

CREATE TABLE construction_journal_lines (
  id           BIGSERIAL PRIMARY KEY,
  entry_id     BIGINT NOT NULL REFERENCES construction_journal_entries(id) ON DELETE CASCADE,
  account_code VARCHAR(20) NOT NULL,
  account_name VARCHAR(120),
  debit        NUMERIC(20, 2) NOT NULL DEFAULT 0,
  credit       NUMERIC(20, 2) NOT NULL DEFAULT 0
);

CREATE INDEX idx_cjl_entry ON construction_journal_lines(entry_id);
