-- ============================================================================
-- 019_hr_payroll.sql — HR Bordro Yönetimi (Faz B-2)
-- ----------------------------------------------------------------------------
-- modules/hr/ payroll dikey dilimi persistence katmanı.
--
-- Tablolar:
--   hr_payroll_runs  → bir şirketin belirli bir dönem (yıl/ay) bordro koşusu
--   hr_payroll_items → koşu içindeki her çalışanın bordro satırı (bordro fişi)
--
-- companies (002), employees (012) yeniden kullanılır.
-- Idempotent: enum'lar guard'lı, tablo/index/trigger IF NOT EXISTS.
-- ============================================================================


-- ============================================================================
-- ENUM'lar — idempotent guard (CREATE TYPE IF NOT EXISTS desteklenmediği için)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_payroll_run_status') THEN
    CREATE TYPE hr_payroll_run_status AS ENUM ('draft', 'finalized');
  END IF;
END
$$;


-- ============================================================================
-- HR_PAYROLL_RUNS — bir dönem için bordro koşusu.
-- Durum makinesi: draft → finalized (terminal)
-- Şirket + dönem (yıl, ay) başına tek koşu (UNIQUE).
-- ============================================================================
CREATE TABLE IF NOT EXISTS hr_payroll_runs (
  id                    SERIAL PRIMARY KEY,
  company_id            INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_year           INT NOT NULL,
  period_month          INT NOT NULL,
  status                hr_payroll_run_status NOT NULL DEFAULT 'draft',
  note                  TEXT,
  finalized_at          TIMESTAMPTZ,
  finalized_by_user_id  INT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT hr_payroll_runs_month_range CHECK (period_month BETWEEN 1 AND 12),
  CONSTRAINT hr_payroll_runs_year_range CHECK (period_year BETWEEN 2000 AND 2200),
  CONSTRAINT uq_hr_payroll_runs_company_period UNIQUE (company_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_hr_payroll_runs_company
  ON hr_payroll_runs(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_payroll_runs_company_status
  ON hr_payroll_runs(company_id, status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'hr_payroll_runs_updated_at'
  ) THEN
    CREATE TRIGGER hr_payroll_runs_updated_at BEFORE UPDATE ON hr_payroll_runs
      FOR EACH ROW EXECUTE FUNCTION trg_updated_at();
  END IF;
END
$$;


-- ============================================================================
-- HR_PAYROLL_ITEMS — koşu içindeki her çalışanın bordro satırı (fişi).
-- Brüt → kesintiler (SGK işçi, işsizlik, gelir vergisi, damga vergisi,
-- diğer kesintiler) → net kırılımı.
-- Bir koşuda her çalışan en fazla 1 kez (UNIQUE run_id, employee_id).
-- ============================================================================
CREATE TABLE IF NOT EXISTS hr_payroll_items (
  id                    SERIAL PRIMARY KEY,
  company_id            INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  run_id                INT NOT NULL REFERENCES hr_payroll_runs(id) ON DELETE CASCADE,
  employee_id           INT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  gross_salary          NUMERIC(14,2) NOT NULL,
  sgk_employee          NUMERIC(14,2) NOT NULL,
  unemployment          NUMERIC(14,2) NOT NULL,
  income_tax            NUMERIC(14,2) NOT NULL,
  stamp_tax             NUMERIC(14,2) NOT NULL,
  other_deductions      NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_salary            NUMERIC(14,2) NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_hr_payroll_items_run_employee UNIQUE (run_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_hr_payroll_items_company_run
  ON hr_payroll_items(company_id, run_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'hr_payroll_items_updated_at'
  ) THEN
    CREATE TRIGGER hr_payroll_items_updated_at BEFORE UPDATE ON hr_payroll_items
      FOR EACH ROW EXECUTE FUNCTION trg_updated_at();
  END IF;
END
$$;


-- ============================================================================
-- Yorumlar (dökümantasyon)
-- ============================================================================
COMMENT ON TABLE hr_payroll_runs IS
  'Faz B-2: dönem bazlı bordro koşusu. Durum makinesi draft/finalized.';
COMMENT ON TABLE hr_payroll_items IS
  'Faz B-2: bordro fişi satırı — brüt/kesintiler/net kırılımı (PayrollCalculator çıktısı).';
