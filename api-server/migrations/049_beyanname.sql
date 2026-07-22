-- ============================================================================
-- 049_beyanname.sql — Beyanname modülü (KDV1 + GİB e-Beyan entegrasyonu)
-- ============================================================================
-- Beyanname hazırlama + GİB e-Beyan REST API üzerinden gönderim/kontrol/onay.
-- İlk beyanname türü KDV1. Entegrasyon kimliği AES-256-GCM şifreli saklanır.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) beyanname_credentials — GİB e-Beyan entegrasyon bilgileri (şifreli)
--    Şifreli config JSON: { apiKey, ortam, entegratorVkn, entegratorUnvan,
--    mukellefVkn, sifat{...}, duzenleyen{...} }
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS beyanname_credentials (
  id                 BIGSERIAL PRIMARY KEY,
  company_id         INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  config_encrypted   BYTEA NOT NULL,            -- AES-256-GCM ciphertext
  config_iv          BYTEA NOT NULL,            -- 12-byte IV
  config_tag         BYTEA NOT NULL,            -- 16-byte auth tag
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by         INT REFERENCES users(id) ON DELETE SET NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id)
);

CREATE INDEX IF NOT EXISTS idx_beyanname_credentials_company ON beyanname_credentials(company_id);
CREATE TRIGGER beyanname_credentials_updated_at BEFORE UPDATE ON beyanname_credentials
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ----------------------------------------------------------------------------
-- 2) beyannameler — hazırlanan beyannameler (lokal + GİB durumu)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS beyannameler (
  id                 BIGSERIAL PRIMARY KEY,
  company_id         INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tur                TEXT NOT NULL DEFAULT 'KDV1' CHECK (tur IN ('KDV1')),
  donem_yil          INT NOT NULL,
  donem_ay           TEXT NOT NULL,             -- OCAK..ARALIK
  donem_tip          TEXT NOT NULL DEFAULT 'AYLIK' CHECK (donem_tip IN ('AYLIK','UC_AYLIK')),
  vergi_dairesi_kod  TEXT,
  vergi_dairesi_ad   TEXT,
  duzeltme_mi        BOOLEAN NOT NULL DEFAULT FALSE,
  durum              TEXT NOT NULL DEFAULT 'taslak'
                       CHECK (durum IN ('taslak','gonderildi','kontrol_edildi','onaylandi','hatali')),
  gib_beyanname_id   TEXT,                      -- GİB tarafındaki beyanname id
  gib_durum          TEXT,                      -- GİB durum (TASLAK/ONAY_BEKLIYOR/ONAYLANDI/...)
  payload            JSONB NOT NULL DEFAULT '{}'::jsonb,  -- matrah/indirimler/istisnalar/ekler/...
  kontrol_sonucu     JSONB,                     -- kontrolEt yanıtı (sekme hataları)
  onay_sonucu        JSONB,                     -- onayla yanıtı (tahakkuk + fiş listesi)
  son_hata           JSONB,                     -- son GİB hata mesajları
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by         INT REFERENCES users(id) ON DELETE SET NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beyannameler_company_donem
  ON beyannameler(company_id, donem_yil, donem_ay);
CREATE INDEX IF NOT EXISTS idx_beyannameler_company_durum
  ON beyannameler(company_id, durum);
CREATE TRIGGER beyannameler_updated_at BEFORE UPDATE ON beyannameler
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ----------------------------------------------------------------------------
-- 3) beyanname_islem_log — her GİB işleminin kaydı (audit + debug)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS beyanname_islem_log (
  id                 BIGSERIAL PRIMARY KEY,
  company_id         INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  beyanname_id       BIGINT REFERENCES beyannameler(id) ON DELETE CASCADE,
  islem              TEXT NOT NULL,             -- send|check|approve|status|draft|pdf:*|...
  gib_endpoint       TEXT,
  http_status        INT,
  trace_id           TEXT,
  mesajlar           JSONB,                     -- GİB messages (success/error/warning/info)
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by         INT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_beyanname_islem_log_company
  ON beyanname_islem_log(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_beyanname_islem_log_beyanname
  ON beyanname_islem_log(beyanname_id);

-- ============================================================================
-- /049_beyanname.sql
-- ============================================================================
