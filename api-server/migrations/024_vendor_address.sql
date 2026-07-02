-- ============================================================================
-- 024_vendor_address.sql
-- Tedarikçilere (vendors) adres ve vergi dairesi alanları — SAS (PO) baskı
-- raporundaki "Satıcı Bilgileri" bloğunu tam doldurmak için.
-- ============================================================================

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tax_office VARCHAR(120);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS address    TEXT;
