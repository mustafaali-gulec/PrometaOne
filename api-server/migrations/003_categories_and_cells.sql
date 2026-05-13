-- ============================================================================
-- 003_categories_and_cells.sql
-- Promet CF — Kategoriler ve nakit akış hücreleri
-- ============================================================================

CREATE TYPE category_section AS ENUM (
  'inflows',         -- Tahsil edilen nakit
  'outflows',        -- Ödenen nakit
  'nonPnlOutflows',  -- Ödenen nakit (Kar/Zarar harici)
  'kasaCategories'   -- Kasa hareketi kategorileri
);

CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  section     category_section NOT NULL,
  name        VARCHAR(200) NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, section, name)
);

CREATE INDEX idx_categories_company ON categories(company_id, section, sort_order);
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ============================================================================
-- CELLS — nakit akış tablosunun çekirdek verisi
-- Bir hücre = (kategori × ay), fiscal year ile birlikte
-- ============================================================================
CREATE TABLE cells (
  id           BIGSERIAL PRIMARY KEY,
  company_id   INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id  INT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  fiscal_year  INT NOT NULL,
  month_idx    SMALLINT NOT NULL CHECK (month_idx BETWEEN 0 AND 11),  -- calendar month (0=Oca)
  value        NUMERIC(20, 2) NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   INT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (company_id, category_id, fiscal_year, month_idx)
);

CREATE INDEX idx_cells_company_year ON cells(company_id, fiscal_year);
CREATE INDEX idx_cells_category ON cells(category_id, fiscal_year);
CREATE TRIGGER cells_updated_at BEFORE UPDATE ON cells
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();
