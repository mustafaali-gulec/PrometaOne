-- ============================================================================
-- 006_exchange_rates_revaluations.sql
-- Promet CF — Döviz kurları ve kur farkı değerleme
-- ============================================================================

-- ============================================================================
-- EXCHANGE RATE HISTORY (TCMB EVDS'den çekilen tarihsel kurlar)
-- ============================================================================
CREATE TABLE exchange_rate_history (
  date          DATE NOT NULL,
  currency      currency_code NOT NULL,
  rate          NUMERIC(12, 6) NOT NULL,
  source        VARCHAR(20) NOT NULL DEFAULT 'TCMB',
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (date, currency)
);

CREATE INDEX idx_xrate_currency_date ON exchange_rate_history(currency, date DESC);

-- View: en güncel kur
CREATE OR REPLACE VIEW v_current_rates AS
SELECT DISTINCT ON (currency)
  currency, rate, date, fetched_at
FROM exchange_rate_history
ORDER BY currency, date DESC;

-- ============================================================================
-- REVALUATIONS (UFRS 21 kur farkı değerleme snapshot'ları)
-- ============================================================================
CREATE TABLE revaluations (
  id                 BIGSERIAL PRIMARY KEY,
  company_id         INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reference_date     DATE NOT NULL,                  -- önceki değerleme tarihi
  valuation_date     DATE NOT NULL,                  -- mevcut değerleme tarihi
  usd_rate_1         NUMERIC(12, 6),                 -- reference USD/TRY
  usd_rate_2         NUMERIC(12, 6),                 -- valuation USD/TRY
  eur_rate_1         NUMERIC(12, 6),
  eur_rate_2         NUMERIC(12, 6),
  gain_total         NUMERIC(20, 2) NOT NULL DEFAULT 0,  -- 646 Kambiyo Karları
  loss_total         NUMERIC(20, 2) NOT NULL DEFAULT 0,  -- 656 Kambiyo Zararları
  net                NUMERIC(20, 2) NOT NULL DEFAULT 0,
  details            JSONB NOT NULL DEFAULT '[]',    -- per-account dökümü
  posted             BOOLEAN NOT NULL DEFAULT FALSE,
  posted_at          TIMESTAMPTZ,
  posted_by          INT REFERENCES users(id) ON DELETE SET NULL,
  created_by         INT REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (valuation_date >= reference_date)
);

CREATE INDEX idx_reval_company_date ON revaluations(company_id, valuation_date DESC);
