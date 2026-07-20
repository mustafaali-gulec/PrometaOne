-- ============================================================================
-- 043_fixed_assets.sql — Sabit Kıymet Yönetimi (Fixed Assets)
-- ----------------------------------------------------------------------------
-- modules/fixedassets/ TS modülünün persistence katmanı.
--
-- Tablolar:
--   fixed_assets                  → Sabit kıymet kartı (amortisman parametreleri dahil)
--   fixed_asset_movements         → Kıymet hareketi (transfer / satış / hurda)
--   fixed_asset_depreciation_runs → Amortisman koşumları (dönem + satırlar JSONB)
--
-- TASARIM KARARI (blob aynası):
--   Kaynak-of-truth UI tarafındaki app-state blob'udur (performance modülü ile
--   aynı model). Bu tablolar POST /v1/fixed-assets/sync ile yazılan
--   SQL-sorgulanabilir aynadır (Report Studio + API erişimi için). Bu yüzden
--   satır kimliği istemci-üretimi client_id TEXT'tir ve tekillik
--   (company_id, client_id) üzerindendir; SERIAL id yalnız iç PK'dır.
--
-- Amortisman hesabı (VUK: normal / azalan bakiyeler + binek oto kıst) DB'de
-- DEĞİL, domain/services/DepreciationCalculator.ts içinde yapılır.
--
-- Tüm tablolar company_id ile multi-tenant izole edilir. companies tablosu
-- (002_companies.sql) ve trg_updated_at() (001) yeniden kullanılır — burada
-- tekrar tanımlanmaz.
-- ============================================================================


-- ============================================================================
-- FIXED_ASSETS — Sabit kıymet kartı
--   method            → 'normal' (eşit tutarlı) | 'declining' (azalan bakiyeler)
--   is_passenger_car  → VUK binek oto kıst amortisman işareti
--   opening_accumulated → sistem öncesi ayrılmış birikmiş amortisman (devir)
-- ============================================================================
CREATE TABLE fixed_assets (
  id                         SERIAL PRIMARY KEY,
  company_id                 INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id                  TEXT NOT NULL,
  code                       TEXT NOT NULL,
  name                       TEXT NOT NULL,
  category                   TEXT,
  location                   TEXT,
  department_id              TEXT,
  employee_id                TEXT,
  acquisition_date           DATE NOT NULL,
  acquisition_cost           NUMERIC(18,2) NOT NULL DEFAULT 0,
  useful_life_years          INT NOT NULL DEFAULT 5,
  method                     TEXT NOT NULL DEFAULT 'normal'
                               CHECK (method IN ('normal', 'declining')),
  is_passenger_car           BOOLEAN NOT NULL DEFAULT FALSE,
  salvage_value              NUMERIC(18,2) NOT NULL DEFAULT 0,
  opening_accumulated        NUMERIC(18,2) NOT NULL DEFAULT 0,
  asset_account_code         TEXT,
  accum_account_code         TEXT,
  expense_account_code       TEXT,
  status                     TEXT NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active', 'sold', 'scrapped', 'inactive')),
  disposal_date              DATE,
  disposal_amount            NUMERIC(18,2),
  disposal_journal_entry_id  TEXT,
  notes                      TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_fixed_assets_company_client UNIQUE (company_id, client_id)
);

CREATE INDEX idx_fixed_assets_company_status
  ON fixed_assets(company_id, status);

CREATE TRIGGER fixed_assets_updated_at BEFORE UPDATE ON fixed_assets
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();


-- ============================================================================
-- FIXED_ASSET_MOVEMENTS — Kıymet hareketi (transfer / satış / hurda)
--   asset_client_id → fixed_assets.client_id referansı (blob aynası olduğundan
--                     FK yerine soft referans; sync sırası bağımsız kalır)
-- ============================================================================
CREATE TABLE fixed_asset_movements (
  id                    SERIAL PRIMARY KEY,
  company_id            INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id             TEXT NOT NULL,
  asset_client_id       TEXT NOT NULL,
  type                  TEXT CHECK (type IN ('transfer', 'sale', 'scrap')),
  date                  DATE NOT NULL,
  amount                NUMERIC(18,2),
  vat_rate              NUMERIC(5,2),
  counter_account_code  TEXT,
  gain_loss             NUMERIC(18,2),
  from_location         TEXT,
  to_location           TEXT,
  notes                 TEXT,
  journal_entry_id      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_fixed_asset_movements_company_client UNIQUE (company_id, client_id)
);

CREATE INDEX idx_fixed_asset_movements_company_asset
  ON fixed_asset_movements(company_id, asset_client_id);


-- ============================================================================
-- FIXED_ASSET_DEPRECIATION_RUNS — Amortisman koşumları
--   period_start / period_end → 'YYYY-MM' dönem anahtarları (TEXT)
--   lines → [{ assetId, amount }] JSONB dizisi (koşum satırları)
-- ============================================================================
CREATE TABLE fixed_asset_depreciation_runs (
  id                SERIAL PRIMARY KEY,
  company_id        INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id         TEXT NOT NULL,
  period_start      TEXT NOT NULL,
  period_end        TEXT NOT NULL,
  run_date          DATE,
  total             NUMERIC(18,2) NOT NULL DEFAULT 0,
  journal_entry_id  TEXT,
  voucher_no        TEXT,
  status            TEXT NOT NULL DEFAULT 'posted',
  lines             JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_fixed_asset_runs_company_client UNIQUE (company_id, client_id)
);

CREATE TRIGGER fixed_asset_depreciation_runs_updated_at
  BEFORE UPDATE ON fixed_asset_depreciation_runs
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();
