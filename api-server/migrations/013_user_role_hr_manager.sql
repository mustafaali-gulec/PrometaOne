-- ============================================================================
-- 013_user_role_hr_manager.sql
-- Faz 4 (HR Core) hazırlığı: user_role ENUM'a 'hr_manager' ekle.
--
-- Karar: docs/adr/0005-hr-manager-role-and-employee-user-link.md
--
-- Hiyerarşi (UserRole.ts ile birebir):
--   viewer < editor < hr_manager < cfo < admin
--
-- PostgreSQL ENUM değer eklemenin geri dönüşü yoktur (DROP edilemez).
-- Bu yüzden ENUM değer adı net seçildi: 'hr_manager'.
-- ============================================================================

-- ENUM'a yeni değer ekle. Sıra önemsiz — DB'de string olarak saklanır,
-- hiyerarşi domain katmanında (UserRole.ts) yönetilir.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'hr_manager';
