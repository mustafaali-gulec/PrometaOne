-- ============================================================================
-- 009_einvoice.sql — Logo eLogo (ve diğer entegratörler) için e-Fatura modülü
-- ============================================================================
-- Promet Bilgi Sistemleri için Logo eLogo (elogo.com.tr) üzerinden gelen ve
-- giden faturaları çekme, cache'leme ve nakit akış sistemine entegrasyon.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) einvoice_credentials — Her şirket için entegratör erişim bilgileri
--    Hassas veriler (password, sessionID) AES-256-GCM ile şifreli tutulur.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS einvoice_credentials (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider             TEXT NOT NULL CHECK (provider IN ('elogo','qnb_efinans','logo_db','mock')),
  -- Provider'a özel config: { username, password, vergi_no, env: 'test'|'prod', wsdl_url, ... }
  config_encrypted     BYTEA NOT NULL,            -- AES-256-GCM encrypted JSON
  config_iv            BYTEA NOT NULL,            -- 12-byte IV
  config_tag           BYTEA NOT NULL,            -- 16-byte auth tag
  -- Sync metadata
  is_active            BOOLEAN NOT NULL DEFAULT true,
  auto_sync_enabled    BOOLEAN NOT NULL DEFAULT false,
  auto_sync_cron       TEXT DEFAULT '0 6 * * *',  -- her sabah 06:00
  last_sync_at         TIMESTAMPTZ,
  last_sync_status     TEXT,                       -- 'success' | 'partial' | 'error'
  last_sync_message    TEXT,
  last_sync_incoming   INTEGER DEFAULT 0,
  last_sync_outgoing   INTEGER DEFAULT 0,
  -- Audit
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by           UUID REFERENCES users(id),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, provider)                    -- her şirket için provider başına 1 kayıt
);

CREATE INDEX idx_einvoice_credentials_company ON einvoice_credentials(company_id);
CREATE INDEX idx_einvoice_credentials_provider ON einvoice_credentials(provider) WHERE is_active = true;

-- ----------------------------------------------------------------------------
-- 2) einvoice_invoices — Entegratörden çekilen faturaların cache'i
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS einvoice_invoices (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider             TEXT NOT NULL,
  -- GİB tarafındaki kimlik
  uuid                 TEXT NOT NULL,              -- ETTN / GİB UUID
  invoice_no           TEXT NOT NULL,
  direction            TEXT NOT NULL CHECK (direction IN ('incoming','outgoing')),
  invoice_type         TEXT,                       -- 'SATIS' | 'IADE' | 'TEVKIFAT' | 'ISTISNA' | ...
  scenario             TEXT,                       -- 'TEMELFATURA' | 'TICARIFATURA' | 'EARSIVFATURA'
  -- Karşı taraf
  party_vkn_tckn       TEXT,                       -- alıcı veya satıcı VKN/TCKN
  party_name           TEXT,
  party_alias          TEXT,                       -- GİB etiket (PK/GB adresi)
  -- Tarih ve tutarlar
  issue_date           DATE NOT NULL,
  due_date             DATE,
  currency             TEXT NOT NULL DEFAULT 'TRY',
  exchange_rate        NUMERIC(18,6),
  subtotal             NUMERIC(18,2),              -- KDV hariç
  kdv_total            NUMERIC(18,2),              -- KDV toplam
  tevkifat_total       NUMERIC(18,2),              -- Tevkifat
  konaklama_vergisi    NUMERIC(18,2),
  ozel_tuketim_vergisi NUMERIC(18,2),
  payable_amount       NUMERIC(18,2) NOT NULL,     -- ödenecek
  -- Durum
  gib_status           TEXT,                       -- 'KABUL_EDILDI' | 'RED' | 'ISLENIYOR' | ...
  response_code        TEXT,                       -- entegratör yanıt kodu
  -- Cache durumu
  imported_invoice_id  UUID REFERENCES invoices(id) ON DELETE SET NULL,  -- bizim invoices tablosundaki karşılık
  imported_at          TIMESTAMPTZ,
  imported_by          UUID REFERENCES users(id),
  ignored              BOOLEAN NOT NULL DEFAULT false,
  ignored_reason       TEXT,
  -- Ham veri
  xml_raw              TEXT,                       -- orijinal UBL-TR 2.1 XML
  pdf_url              TEXT,                       -- entegratörün PDF endpoint'i (lazy)
  -- Audit
  fetched_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, uuid)
);

CREATE INDEX idx_einvoice_invoices_company_dir ON einvoice_invoices(company_id, direction);
CREATE INDEX idx_einvoice_invoices_issue_date ON einvoice_invoices(issue_date DESC);
CREATE INDEX idx_einvoice_invoices_party ON einvoice_invoices(party_vkn_tckn);
CREATE INDEX idx_einvoice_invoices_pending ON einvoice_invoices(company_id, direction)
  WHERE imported_invoice_id IS NULL AND ignored = false;

-- ----------------------------------------------------------------------------
-- 3) einvoice_sync_log — Her sync işleminin detaylı kaydı (audit + debug)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS einvoice_sync_log (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider             TEXT NOT NULL,
  trigger              TEXT NOT NULL CHECK (trigger IN ('manual','cron','api','webhook')),
  started_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at          TIMESTAMPTZ,
  status               TEXT,                       -- 'success' | 'partial' | 'error'
  -- Sayaçlar
  incoming_fetched     INTEGER DEFAULT 0,
  incoming_new         INTEGER DEFAULT 0,
  outgoing_fetched     INTEGER DEFAULT 0,
  outgoing_new         INTEGER DEFAULT 0,
  errors_count         INTEGER DEFAULT 0,
  -- Hata detayı
  error_message        TEXT,
  error_stack          TEXT,
  -- Tetikleyici
  triggered_by         UUID REFERENCES users(id),
  date_from            DATE,
  date_to              DATE
);

CREATE INDEX idx_einvoice_sync_log_company ON einvoice_sync_log(company_id, started_at DESC);

-- ----------------------------------------------------------------------------
-- 4) einvoice_party_mapping — Karşı taraf (VKN) → mevcut müşteri/tedarikçi eşleme
--    Otomatik faturaları doğru taraf altında listelemek için.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS einvoice_party_mapping (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vkn_tckn             TEXT NOT NULL,
  display_name         TEXT,                       -- bizim sistemde gösterilen ad
  cashflow_cat_id      TEXT,                       -- varsayılan NA kalemi
  auto_import          BOOLEAN NOT NULL DEFAULT false,  -- bu VKN'den gelen faturalar otomatik aktarılsın mı
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, vkn_tckn)
);

CREATE INDEX idx_einvoice_party_mapping_lookup ON einvoice_party_mapping(company_id, vkn_tckn);

-- ----------------------------------------------------------------------------
-- 5) View: einvoice_pending — Henüz aktarılmamış faturalar (UI için)
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
WHERE ei.imported_invoice_id IS NULL AND ei.ignored = false;

-- ============================================================================
-- /009_einvoice.sql
-- ============================================================================
