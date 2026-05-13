-- ============================================================================
-- 002_companies.sql
-- Promet CF — Şirketler ve kullanıcı erişim ilişkileri
-- ============================================================================

CREATE TABLE companies (
  id                  SERIAL PRIMARY KEY,
  name                VARCHAR(200) NOT NULL,
  tax_no              VARCHAR(20),
  color               VARCHAR(20) DEFAULT '#dc2626',
  fiscal_year         INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  fiscal_start_month  SMALLINT NOT NULL DEFAULT 0 CHECK (fiscal_start_month BETWEEN 0 AND 11),
  opening_cash        NUMERIC(20, 2) NOT NULL DEFAULT 0,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_by          INT REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_companies_active ON companies(active) WHERE active = TRUE;
CREATE TRIGGER companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- audit_logs.company_id FK
ALTER TABLE audit_logs
  ADD CONSTRAINT fk_audit_company FOREIGN KEY (company_id)
  REFERENCES companies(id) ON DELETE SET NULL;

-- ============================================================================
-- USER COMPANY ACCESS
-- Bir kullanıcı birden fazla şirkete farklı rollerle erişebilir.
-- Yoksa users.role ile global rol gerçekleşir (admin tüm şirketlere erişir).
-- ============================================================================
CREATE TABLE user_company_access (
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role        user_role NOT NULL,                 -- şirket bazında override
  granted_by  INT REFERENCES users(id) ON DELETE SET NULL,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, company_id)
);

CREATE INDEX idx_uca_company ON user_company_access(company_id);

-- ============================================================================
-- USER PREFERENCES (UI state, aktif şirket vb.)
-- ============================================================================
CREATE TABLE user_preferences (
  user_id            INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  active_company_id  INT REFERENCES companies(id) ON DELETE SET NULL,
  display_currency   VARCHAR(3) DEFAULT 'TRY' CHECK (display_currency IN ('TRY','USD','EUR')),
  ui_settings        JSONB NOT NULL DEFAULT '{}',
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
