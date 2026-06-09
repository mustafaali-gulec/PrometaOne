-- ============================================================================
-- 030_einvoice_manual_provider.sql — 'manual' provider tipi
-- ============================================================================
-- Elle yüklenen e-fatura dosyaları (GİB HTML / UBL XML) için provider='manual'.
-- einvoice_invoices.provider'da CHECK yok (serbest), ancak einvoice_credentials
-- CHECK'i tip listesiyle tutarlı kalsın diye genişletilir. Manuel yüklemeler
-- kimlik bilgisi (credential) oluşturmaz; bu yalnız ProviderType ile uyum içindir.
-- ============================================================================

ALTER TABLE einvoice_credentials
  DROP CONSTRAINT IF EXISTS einvoice_credentials_provider_check;

ALTER TABLE einvoice_credentials
  ADD CONSTRAINT einvoice_credentials_provider_check
  CHECK (provider IN ('elogo','qnb_efinans','logo_db','mock','manual'));

-- ============================================================================
-- /030_einvoice_manual_provider.sql
-- ============================================================================
