-- ============================================================================
-- 004_fx_currency_fields.sql — Şantiye kayıtlarında dövizli tutar (FX)
-- ----------------------------------------------------------------------------
-- Monolitteki api-server/migrations/051_fx_currency_fields.sql ile AYNI
-- sözleşme (bkz. frontend/src/shared/fx/fxCore.ts):
--
--   currency        : tutarın girildiği para birimi (zaten var — 001)
--   <amount>        : ORİJİNAL para birimindeki tutar (zaten var)
--   fx_rate         : 1 birim döviz kaç TRY — KAYIT ANINDA DONDURULUR
--   fx_rate_source  : 'manual' | 'tcmb'
--   fx_rate_date    : kurun ait olduğu gün
--   <amount>_try    : kurdan türetilen TRY karşılığı (raporların topladığı kolon)
--
-- NEDEN: hakediş/gider/avans kayıtları yıllara yayılır; kur güncellenince
-- geçmiş şantiye maliyetleri KAYMAMALI. Proje bütçe-gerçekleşme karşılaştırması
-- _try kolonları üzerinden yapılır.
--
-- construction-service KENDİ DB'sinde çalışır (bağımsız mikroservis).
-- Idempotent: ADD COLUMN IF NOT EXISTS.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fx_rate_source') THEN
    CREATE TYPE fx_rate_source AS ENUM ('manual', 'tcmb');
  END IF;
END $$;

-- --- Sözleşmeler (cs_contracts) ---------------------------------------------
ALTER TABLE cs_contracts ADD COLUMN IF NOT EXISTS fx_rate        NUMERIC(20, 6);
ALTER TABLE cs_contracts ADD COLUMN IF NOT EXISTS fx_rate_source fx_rate_source;
ALTER TABLE cs_contracts ADD COLUMN IF NOT EXISTS fx_rate_date   DATE;
ALTER TABLE cs_contracts ADD COLUMN IF NOT EXISTS amount_try     NUMERIC(20, 2);

-- --- Hakedişler (cs_progress_payments) --------------------------------------
-- Tek "amount" kolonu yok: brüt (gross_this) ve net ödenecek (net_payable)
-- ayrı ayrı TRY karşılığı taşır — muhasebe fişi net_payable_try üzerinden kesilir.
ALTER TABLE cs_progress_payments ADD COLUMN IF NOT EXISTS fx_rate         NUMERIC(20, 6);
ALTER TABLE cs_progress_payments ADD COLUMN IF NOT EXISTS fx_rate_source  fx_rate_source;
ALTER TABLE cs_progress_payments ADD COLUMN IF NOT EXISTS fx_rate_date    DATE;
ALTER TABLE cs_progress_payments ADD COLUMN IF NOT EXISTS gross_this_try  NUMERIC(20, 2);
ALTER TABLE cs_progress_payments ADD COLUMN IF NOT EXISTS net_payable_try NUMERIC(20, 2);

-- --- Giderler (cs_expenses) --------------------------------------------------
ALTER TABLE cs_expenses ADD COLUMN IF NOT EXISTS fx_rate        NUMERIC(20, 6);
ALTER TABLE cs_expenses ADD COLUMN IF NOT EXISTS fx_rate_source fx_rate_source;
ALTER TABLE cs_expenses ADD COLUMN IF NOT EXISTS fx_rate_date   DATE;
ALTER TABLE cs_expenses ADD COLUMN IF NOT EXISTS amount_try     NUMERIC(20, 2);

-- --- Avanslar (cs_advances) --------------------------------------------------
ALTER TABLE cs_advances ADD COLUMN IF NOT EXISTS fx_rate           NUMERIC(20, 6);
ALTER TABLE cs_advances ADD COLUMN IF NOT EXISTS fx_rate_source    fx_rate_source;
ALTER TABLE cs_advances ADD COLUMN IF NOT EXISTS fx_rate_date      DATE;
ALTER TABLE cs_advances ADD COLUMN IF NOT EXISTS amount_try        NUMERIC(20, 2);
ALTER TABLE cs_advances ADD COLUMN IF NOT EXISTS offset_amount_try NUMERIC(20, 2);

-- --- Kasa hareketleri (cs_cash_movements) ------------------------------------
ALTER TABLE cs_cash_movements ADD COLUMN IF NOT EXISTS fx_rate        NUMERIC(20, 6);
ALTER TABLE cs_cash_movements ADD COLUMN IF NOT EXISTS fx_rate_source fx_rate_source;
ALTER TABLE cs_cash_movements ADD COLUMN IF NOT EXISTS fx_rate_date   DATE;
ALTER TABLE cs_cash_movements ADD COLUMN IF NOT EXISTS amount_try     NUMERIC(20, 2);

-- --- Ödemeler (cs_payments, 003) ---------------------------------------------
ALTER TABLE cs_payments ADD COLUMN IF NOT EXISTS fx_rate        NUMERIC(20, 6);
ALTER TABLE cs_payments ADD COLUMN IF NOT EXISTS fx_rate_source fx_rate_source;
ALTER TABLE cs_payments ADD COLUMN IF NOT EXISTS fx_rate_date   DATE;
ALTER TABLE cs_payments ADD COLUMN IF NOT EXISTS amount_try     NUMERIC(20, 2);

-- --- Geriye dönük doldurma: TRY satırlarda TRY karşılığı = tutarın kendisi ---
UPDATE cs_contracts         SET amount_try = amount        WHERE amount_try IS NULL AND currency = 'TRY';
UPDATE cs_progress_payments SET gross_this_try  = gross_this,
                                net_payable_try = net_payable  WHERE net_payable_try IS NULL AND currency = 'TRY';
UPDATE cs_expenses          SET amount_try = amount        WHERE amount_try IS NULL AND currency = 'TRY';
UPDATE cs_advances          SET amount_try = amount,
                                offset_amount_try = offset_amount
                                                               WHERE amount_try IS NULL AND currency = 'TRY';
UPDATE cs_cash_movements    SET amount_try = amount        WHERE amount_try IS NULL AND currency = 'TRY';
UPDATE cs_payments          SET amount_try = amount        WHERE amount_try IS NULL AND currency = 'TRY';

-- --- Raporlama indeksleri (dövizli satırlar) ---------------------------------
CREATE INDEX IF NOT EXISTS idx_cs_expenses_fx  ON cs_expenses(project_id, currency)  WHERE currency <> 'TRY';
CREATE INDEX IF NOT EXISTS idx_cs_contracts_fx ON cs_contracts(project_id, currency) WHERE currency <> 'TRY';
