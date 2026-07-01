-- ============================================================================
-- 039_expense_card_attributes.sql
-- Prometa One — Gider Kartları zenginleştirme: sekmeli kart editörü için ek
-- öznitelikler (KDV/tevkifat/kanunen kabul + bütçe/ödeme/varsayılanlar) tek bir
-- JSONB kolonda tutulur. Mevcut satırlar boş obje ('{}') ile doldurulur.
--
-- attributes şekli (hepsi opsiyonel, frontend/backend DTO ile eşlenir):
--   { kdvRate, tevkifatCode, taxDeductible, costCenter, paymentMethod,
--     currency, defaultAmount, monthlyBudget, recurring, vendor }
-- ============================================================================

ALTER TABLE expense_cards
  ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;
