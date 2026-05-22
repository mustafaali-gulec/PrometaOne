-- ============================================================================
-- 014_hr_employee_no_sequence.sql
-- Faz 4 / PR 4a: Şirket-bazlı employee_no sayacı için tablo.
--
-- PG SEQUENCE doğrudan companyId parametresi alamadığı için
-- (sequence per-company istiyoruz), basit bir counter tablosu kullanırız.
-- ============================================================================

CREATE TABLE hr_employee_no_counters (
  company_id  INT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  next_value  BIGINT NOT NULL DEFAULT 1
);

COMMENT ON TABLE hr_employee_no_counters IS
  'Faz 4 / PR 4a: SequentialEmployeeNumberGenerator için şirket-bazlı sayaç.';
