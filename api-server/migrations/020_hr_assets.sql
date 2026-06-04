-- ============================================================================
-- 020_hr_assets.sql — HR Zimmet / Varlık Yönetimi (Faz B-3)
-- ----------------------------------------------------------------------------
-- modules/hr/ asset (zimmet) dikey dilimi persistence katmanı.
--
-- Tablolar:
--   hr_assets             → bir şirketin varlık havuzu (laptop, telefon, araç...)
--   hr_asset_assignments  → zimmet atama/iade geçmişi (ledger)
--
-- companies (002), employees (012) yeniden kullanılır.
-- Idempotent: enum'lar guard'lı, tablo/index/trigger IF NOT EXISTS.
-- ============================================================================


-- ============================================================================
-- ENUM'lar — idempotent guard (CREATE TYPE IF NOT EXISTS desteklenmediği için)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_asset_type') THEN
    CREATE TYPE hr_asset_type AS ENUM (
      'laptop', 'desktop', 'phone', 'vehicle', 'card', 'monitor', 'headset',
      'tablet', 'printer', 'furniture', 'key_lock', 'uniform', 'ppe', 'other'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_asset_status') THEN
    CREATE TYPE hr_asset_status AS ENUM (
      'in_stock', 'assigned', 'maintenance', 'retired', 'lost'
    );
  END IF;
END
$$;


-- ============================================================================
-- HR_ASSETS — şirketin varlık havuzu.
-- Durum makinesi: in_stock ↔ assigned, in_stock ↔ maintenance,
--                 any → retired, any → lost
-- assigned olduğunda assigned_employee_id NOT NULL; diğer durumlarda NULL.
-- ============================================================================
CREATE TABLE IF NOT EXISTS hr_assets (
  id                    SERIAL PRIMARY KEY,
  company_id            INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_type            hr_asset_type NOT NULL,
  name                  TEXT NOT NULL,
  brand                 TEXT,
  model                 TEXT,
  serial_no             TEXT,
  status                hr_asset_status NOT NULL DEFAULT 'in_stock',
  assigned_employee_id  INT REFERENCES employees(id) ON DELETE SET NULL,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_assets_company
  ON hr_assets(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_assets_company_status
  ON hr_assets(company_id, status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'hr_assets_updated_at'
  ) THEN
    CREATE TRIGGER hr_assets_updated_at BEFORE UPDATE ON hr_assets
      FOR EACH ROW EXECUTE FUNCTION trg_updated_at();
  END IF;
END
$$;


-- ============================================================================
-- HR_ASSET_ASSIGNMENTS — zimmet atama/iade geçmişi (ledger).
-- Açık atama = returned_at IS NULL. Bir varlığın en fazla bir açık ataması olur
-- (use-case düzeyinde garanti edilir).
-- ============================================================================
CREATE TABLE IF NOT EXISTS hr_asset_assignments (
  id                    SERIAL PRIMARY KEY,
  company_id            INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id              INT NOT NULL REFERENCES hr_assets(id) ON DELETE CASCADE,
  employee_id           INT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  assigned_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by_user_id   INT,
  returned_at           TIMESTAMPTZ,
  returned_by_user_id   INT,
  return_note           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_asset_assignments_company_asset
  ON hr_asset_assignments(company_id, asset_id);
CREATE INDEX IF NOT EXISTS idx_hr_asset_assignments_company_employee
  ON hr_asset_assignments(company_id, employee_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'hr_asset_assignments_updated_at'
  ) THEN
    CREATE TRIGGER hr_asset_assignments_updated_at BEFORE UPDATE ON hr_asset_assignments
      FOR EACH ROW EXECUTE FUNCTION trg_updated_at();
  END IF;
END
$$;


-- ============================================================================
-- Yorumlar (dökümantasyon)
-- ============================================================================
COMMENT ON TABLE hr_assets IS
  'Faz B-3: şirket varlık havuzu (zimmet). Durum makinesi in_stock/assigned/maintenance/retired/lost.';
COMMENT ON TABLE hr_asset_assignments IS
  'Faz B-3: zimmet atama/iade geçmişi (ledger). Açık atama returned_at IS NULL.';
