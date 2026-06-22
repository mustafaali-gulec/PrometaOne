-- ============================================================================
-- 038_material_prices.sql — Malzeme varsayılan fiyat alanları
-- ----------------------------------------------------------------------------
-- 034_warehouse.materials tablosuna iki varsayılan fiyat kolonu ekler:
--   purchase_price → varsayılan alış fiyatı
--   sale_price     → varsayılan satış fiyatı
--
-- Frontend bu alanları zaten malzeme kartında gönderiyordu ancak backend'de
-- kolon olmadığı için düşürülüyordu (BOM maliyeti ve stok raporları 0 görüyordu).
-- NUMERIC(20,4) — parasal alanlar için geniş aralık + 4 ondalık hassasiyet.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS (kolon zaten varsa atlar).
-- ============================================================================

ALTER TABLE materials ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(20,4);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS sale_price NUMERIC(20,4);
