-- ============================================================================
-- 041_licensing.sql
-- Prometa One — Ed25519 imzalı lisanslama: aktif lisans deposu (license_store,
-- tek satır id=1) + kayıtlı terminaller / koltuklar (license_terminals).
--
-- Lisans tools/license-generator ile kesilir, POST /v1/license/activate (veya
-- npm run license:activate) ile buraya yazılır. license_json = { payload,
-- signature } — doğrulama HER OKUYUŞTA uygulama katmanında yapılır (DB'deki
-- kayıt tek başına yetki vermez; imza publicKey.ts'teki anahtara göre kontrol
-- edilir). Terminal kayıtları licenseGuard'ın koltuk sınırı içindir; silmek
-- koltuğu boşaltır. Idempotent (IF NOT EXISTS).
-- ============================================================================

CREATE TABLE IF NOT EXISTS license_store (
  id            SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  license_json  JSONB NOT NULL,
  activated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_by  TEXT
);

CREATE TABLE IF NOT EXISTS license_terminals (
  terminal_id  UUID PRIMARY KEY,
  name         TEXT,
  username     TEXT,
  first_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
