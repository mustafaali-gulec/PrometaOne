-- ============================================================================
-- 053_hr_linkedin.sql — İşe Alım · LinkedIn otomatik ilan entegrasyonu
-- ============================================================================
-- İlan "Yayınla" denince LinkedIn'e otomatik düşsün diye üç kanal:
--   share    → LinkedIn şirket sayfasına gönderi (Posts API, OAuth 2.0)
--   feed     → public XML iş ilanı beslemesi (LinkedIn crawl eder → native ilan)
--   job_api  → LinkedIn Job Posting API (Talent Solutions PARTNER onayı ister;
--              şema burada hazır, sağlayıcı implementasyonu partnerlik gelince)
--
-- OAuth token'ları AES-256-GCM ile şifreli saklanır (einvoice/beyanname kalıbı).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) hr_linkedin_connections — şirket başına tek LinkedIn bağlantısı (şifreli)
--    Şifreli config JSON: { clientId, clientSecret, accessToken, refreshToken }
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hr_linkedin_connections (
  id                    BIGSERIAL PRIMARY KEY,
  company_id            INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  config_encrypted      BYTEA NOT NULL,             -- AES-256-GCM ciphertext
  config_iv             BYTEA NOT NULL,             -- 12-byte IV
  config_tag            BYTEA NOT NULL,             -- 16-byte auth tag
  organization_urn      TEXT,                       -- urn:li:organization:12345
  organization_name     TEXT,
  token_expires_at      TIMESTAMPTZ,
  -- Otomasyon ayarları
  auto_publish          BOOLEAN NOT NULL DEFAULT TRUE,
  channels              TEXT[] NOT NULL DEFAULT ARRAY['share']::TEXT[],
  -- Public XML beslemesini koruyan rastgele jeton (URL'de ?token=)
  feed_token            TEXT,
  -- Başvuru linki tabanı — ilan slug'ı buna eklenir (örn https://kariyer.firma.com/ilan)
  career_site_base_url  TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  last_error            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            INT REFERENCES users(id) ON DELETE SET NULL,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id)
);

CREATE INDEX IF NOT EXISTS idx_hr_linkedin_conn_company
  ON hr_linkedin_connections(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_linkedin_conn_feed_token
  ON hr_linkedin_connections(feed_token) WHERE feed_token IS NOT NULL;
CREATE TRIGGER hr_linkedin_connections_updated_at BEFORE UPDATE ON hr_linkedin_connections
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ----------------------------------------------------------------------------
-- 2) hr_job_posting_feed — yayınlanmış ilanların sunucu tarafı anlık görüntüsü
--    İlanlar app-state blob'unda (hrJobPostings) yaşar; public XML beslemesinin
--    auth'suz okuyabilmesi için "Yayınla" anında buraya kopyalanır.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hr_job_posting_feed (
  id                BIGSERIAL PRIMARY KEY,
  company_id        INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  posting_ref       TEXT NOT NULL,                  -- blob'daki hrJobPostings[].id
  slug              TEXT,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  location          TEXT,
  employment_type   TEXT,                           -- full_time|part_time|contract|intern|...
  company_name      TEXT,
  apply_url         TEXT,
  status            TEXT NOT NULL DEFAULT 'published'
                      CHECK (status IN ('published','closed')),
  published_at      TIMESTAMPTZ,
  closed_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, posting_ref)
);

CREATE INDEX IF NOT EXISTS idx_hr_job_posting_feed_company_status
  ON hr_job_posting_feed(company_id, status);
CREATE TRIGGER hr_job_posting_feed_updated_at BEFORE UPDATE ON hr_job_posting_feed
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ----------------------------------------------------------------------------
-- 3) hr_linkedin_posts — kanal başına gönderim kaydı (audit + tekrar-gönderim
--    koruması + UI'daki "LinkedIn'de yayında" rozeti bu tablodan beslenir)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hr_linkedin_posts (
  id                BIGSERIAL PRIMARY KEY,
  company_id        INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  posting_ref       TEXT NOT NULL,
  channel           TEXT NOT NULL CHECK (channel IN ('share','feed','job_api')),
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','published','failed','removed')),
  post_urn          TEXT,                           -- urn:li:share:… / urn:li:ugcPost:…
  post_url          TEXT,
  title             TEXT,
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        INT REFERENCES users(id) ON DELETE SET NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, posting_ref, channel)
);

CREATE INDEX IF NOT EXISTS idx_hr_linkedin_posts_company
  ON hr_linkedin_posts(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hr_linkedin_posts_ref
  ON hr_linkedin_posts(company_id, posting_ref);
CREATE TRIGGER hr_linkedin_posts_updated_at BEFORE UPDATE ON hr_linkedin_posts
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ============================================================================
-- /053_hr_linkedin.sql
-- ============================================================================
