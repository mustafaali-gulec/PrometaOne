-- 017: bank_accounts.accounting_code
-- Banka hesabina bagli muhasebe hesap kodu (Tek Duzen Hesap Plani, ornek "102.01").
-- Serbest metin; ortamda ayri bir hesap plani (COA) tablosu olmadigi icin FK degil.
-- Idempotent.

ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS accounting_code VARCHAR(40);
