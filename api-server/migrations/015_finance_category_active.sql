-- ============================================================================
-- 015_finance_category_active.sql
-- Faz 5 / PR 6c — Kategori arşivleme desteği.
--
-- 003_categories_and_cells.sql'de `categories` tablosu `active` kolonu olmadan
-- oluşturulmuştu. Clean Architecture finance modülü (Faz 5) kategorileri
-- silmek yerine arşivliyor (ArchiveCategoryUseCase → active=FALSE). Bu migration
-- eksik kolonu ekler.
--
-- Idempotent: IF NOT EXISTS ile tekrar çalıştırmaya dayanıklı.
-- ============================================================================

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

-- Aktif kategorileri company+section bazında listelerken kullanılır.
CREATE INDEX IF NOT EXISTS idx_categories_company_active
  ON categories(company_id, section, sort_order)
  WHERE active = TRUE;
