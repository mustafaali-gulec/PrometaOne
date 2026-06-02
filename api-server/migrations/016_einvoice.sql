-- ============================================================================
-- 016_einvoice.sql — E-Fatura modülü (Faz 6) — INT FK düzeltilmiş şema
-- ============================================================================
-- 009_einvoice.sql UUID FK tipleriyle yazıldığı için (companies/users/invoices
-- INT iken) hiç uygulanamıyordu. Bu migration aynı tabloları DOĞRU INT/BIGINT
-- yabancı anahtar tipleriyle kurar. 009 artık NO-OP.
--
-- Logo eLogo / QNB eFinans entegratörü üzerinden gelen/giden faturaları çekme,
-- cache'leme ve Faz 5 `invoices` tablosuna atomik import.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) einvoice_credentials — entegratör erişim bilgileri (AES-256-GCM şifreli)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS einvoice_credentials (
  id                   BIGSERIAL PRIMARY KEY,
  company_id           INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider             TEXT NOT NULL CHECK (provider IN ('elogo','qnb_efinans','logo_db','mock')),
  -- Provider'a özel config: { username, password, vergiNo, env, wsdlUrl, ... }
  config_encrypted     BYTEA NOT NULL,            -- AES-256-GCM ciphertext
  config_iv            BYTEA NOT NULL,            -- 12-byte IV
  config_tag           BYTEA NOT NULL,            -- 16-byte auth tag
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  auto_sync_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  auto_sync_cron       TEXT DEFAULT '0 6 * * *',
  last_sync_at         TIMESTAMPTZ,
  last_sync_status     TEXT,                       -- 'success' | 'partial' | 'error'
  last_sync_message    TEXT,
  last_sync_incoming   INTEGER NOT NULL DEFAULT 0,
  last_sync_outgoing   INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by           INT REFERENCES users(id) ON DELETE SET NULL,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_einvoice_credentials_company ON einvoice_credentials(company_id);
CREATE INDEX IF NOT EXISTS idx_einvoice_credentials_provider ON einvoice_credentials(provider) WHERE is_active = TRUE;
CREATE TRIGGER einvoice_credentials_updated_at BEFORE UPDATE ON einvoice_credentials
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ----------------------------------------------------------------------------
-- 2) einvoice_invoices — entegratörden çekilen faturaların cache'i
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS einvoice_invoices (
  id                   BIGSERIAL PRIMARY KEY,
  company_id           INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider             TEXT NOT NULL,
  uuid                 TEXT NOT NULL,              -- ETTN / GİB UUID
  invoice_no           TEXT NOT NULL,
  direction            TEXT NOT NULL CHECK (direction IN ('incoming','outgoing')),
  invoice_type         TEXT,                       -- SATIS | IADE | TEVKIFAT | ISTISNA | ...
  scenario             TEXT,                       -- TEMELFATURA | TICARIFATURA | EARSIVFATURA
  party_vkn_tckn       TEXT,
  party_name           TEXT,
  party_alias          TEXT,
  issue_date           DATE NOT NULL,
  due_date             DATE,
  currency             currency_code NOT NULL DEFAULT 'TRY',
  exchange_rate        NUMERIC(18,6),
  subtotal             NUMERIC(20,2),
  kdv_total            NUMERIC(20,2),
  tevkifat_total       NUMERIC(20,2),
  konaklama_vergisi    NUMERIC(20,2),
  ozel_tuketim_vergisi NUMERIC(20,2),
  payable_amount       NUMERIC(20,2) NOT NULL,
  gib_status           TEXT,
  response_code        TEXT,
  imported_invoice_id  BIGINT REFERENCES invoices(id) ON DELETE SET NULL,
  imported_at          TIMESTAMPTZ,
  imported_by          INT REFERENCES users(id) ON DELETE SET NULL,
  ignored              BOOLEAN NOT NULL DEFAULT FALSE,
  ignored_reason       TEXT,
  xml_raw              TEXT,
  pdf_url              TEXT,
  fetched_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, uuid)
);

CREATE INDEX IF NOT EXISTS idx_einvoice_invoices_company_dir ON einvoice_invoices(company_id, direction);
CREATE INDEX IF NOT EXISTS idx_einvoice_invoices_issue_date ON einvoice_invoices(issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_einvoice_invoices_party ON einvoice_invoices(party_vkn_tckn);
CREATE INDEX IF NOT EXISTS idx_einvoice_invoices_pending ON einvoice_invoices(company_id, direction)
  WHERE imported_invoice_id IS NULL AND ignored = FALSE;
CREATE TRIGGER einvoice_invoices_updated_at BEFORE UPDATE ON einvoice_invoices
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ----------------------------------------------------------------------------
-- 3) einvoice_sync_log — her sync işleminin kaydı (audit + debug)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS einvoice_sync_log (
  id                   BIGSERIAL PRIMARY KEY,
  company_id           INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider             TEXT NOT NULL,
  trigger              TEXT NOT NULL CHECK (trigger IN ('manual','cron','api','webhook')),
  started_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at          TIMESTAMPTZ,
  status               TEXT,                       -- 'success' | 'partial' | 'error'
  incoming_fetched     INTEGER NOT NULL DEFAULT 0,
  incoming_new         INTEGER NOT NULL DEFAULT 0,
  outgoing_fetched     INTEGER NOT NULL DEFAULT 0,
  outgoing_new         INTEGER NOT NULL DEFAULT 0,
  errors_count         INTEGER NOT NULL DEFAULT 0,
  error_message        TEXT,
  error_stack          TEXT,
  triggered_by         INT REFERENCES users(id) ON DELETE SET NULL,
  date_from            DATE,
  date_to              DATE
);

CREATE INDEX IF NOT EXISTS idx_einvoice_sync_log_company ON einvoice_sync_log(company_id, started_at DESC);

-- ----------------------------------------------------------------------------
-- 4) einvoice_party_mapping — VKN → mevcut müşteri/tedarikçi + cashflow kategori
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS einvoice_party_mapping (
  id                   BIGSERIAL PRIMARY KEY,
  company_id           INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vkn_tckn             TEXT NOT NULL,
  display_name         TEXT,
  cashflow_cat_id      INT REFERENCES categories(id) ON DELETE SET NULL,
  auto_import          BOOLEAN NOT NULL DEFAULT FALSE,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, vkn_tckn)
);

CREATE INDEX IF NOT EXISTS idx_einvoice_party_mapping_lookup ON einvoice_party_mapping(company_id, vkn_tckn);
CREATE TRIGGER einvoice_party_mapping_updated_at BEFORE UPDATE ON einvoice_party_mapping
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ----------------------------------------------------------------------------
-- 5) View: einvoice_pending — henüz aktarılmamış faturalar (UI için)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW einvoice_pending AS
SELECT
  ei.id, ei.company_id, ei.provider, ei.direction,
  ei.invoice_no, ei.issue_date, ei.due_date,
  ei.party_vkn_tckn, ei.party_name,
  ei.currency, ei.subtotal, ei.kdv_total, ei.tevkifat_total, ei.payable_amount,
  ei.gib_status, ei.uuid, ei.fetched_at,
  epm.display_name AS mapped_party_name,
  epm.cashflow_cat_id AS suggested_cashflow_cat_id,
  epm.auto_import
FROM einvoice_invoices ei
LEFT JOIN einvoice_party_mapping epm
  ON epm.company_id = ei.company_id AND epm.vkn_tckn = ei.party_vkn_tckn
WHERE ei.imported_invoice_id IS NULL AND ei.ignored = FALSE;

-- ============================================================================
-- /016_einvoice.sql
-- ============================================================================
