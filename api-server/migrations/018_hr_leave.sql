-- ============================================================================
-- 018_hr_leave.sql — HR İzin Yönetimi (Faz B-1)
-- ----------------------------------------------------------------------------
-- modules/hr/ leave-request dikey dilimi persistence katmanı.
--
-- Tablolar:
--   hr_leave_requests → çalışan izin talepleri (durum makinesi + bakiye kaynağı)
--
-- NOT: Dosya adı 018_ olarak verildi çünkü 015_ numarası
--      015_finance_category_active.sql tarafından kullanılıyor (alfabetik
--      migration runner çakışmasını önlemek için).
--
-- companies (002), employees (012) yeniden kullanılır.
-- Idempotent: enum'lar guard'lı, tablo/index/trigger IF NOT EXISTS.
-- ============================================================================


-- ============================================================================
-- ENUM'lar — idempotent guard (CREATE TYPE IF NOT EXISTS desteklenmediği için)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_leave_type') THEN
    CREATE TYPE hr_leave_type AS ENUM ('annual', 'sick', 'unpaid', 'maternity', 'other');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_leave_status') THEN
    CREATE TYPE hr_leave_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
  END IF;
END
$$;


-- ============================================================================
-- HR_LEAVE_REQUESTS — çalışan izin talepleri.
-- Durum makinesi: pending → approved | rejected | cancelled
--                 approved → cancelled
--                 terminal: rejected, cancelled
-- ============================================================================
CREATE TABLE IF NOT EXISTS hr_leave_requests (
  id                    SERIAL PRIMARY KEY,
  company_id            INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id           INT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  leave_type            hr_leave_type NOT NULL,
  start_date            DATE NOT NULL,
  end_date              DATE NOT NULL,
  days                  INT NOT NULL,
  reason                TEXT,
  status                hr_leave_status NOT NULL DEFAULT 'pending',
  requested_by_user_id  INT,
  decided_by_user_id    INT,
  decided_at            TIMESTAMPTZ,
  decision_note         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT hr_leave_requests_days_positive CHECK (days > 0),
  CONSTRAINT hr_leave_requests_date_order CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_company_employee
  ON hr_leave_requests(company_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_company_status
  ON hr_leave_requests(company_id, status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'hr_leave_requests_updated_at'
  ) THEN
    CREATE TRIGGER hr_leave_requests_updated_at BEFORE UPDATE ON hr_leave_requests
      FOR EACH ROW EXECUTE FUNCTION trg_updated_at();
  END IF;
END
$$;


-- ============================================================================
-- Yorumlar (dökümantasyon)
-- ============================================================================
COMMENT ON TABLE hr_leave_requests IS
  'Faz B-1: çalışan izin talepleri. Durum makinesi pending/approved/rejected/cancelled.';
