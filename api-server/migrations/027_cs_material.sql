-- ============================================================================
-- 027_cs_material.sql
-- Prometa One — Şantiye Yönetim (Construction) Faz SF-5: Malzeme & Depo.
--
-- E5 bileşeni: Malzeme master (fire oranı), depolar (projeye bağlı), stok cache,
-- stok hareketleri (giriş/çıkış/transfer/fire/sayım) ve malzeme talep + onay.
-- Hareket kaydı stok cache'ini transaction içinde günceller.
-- ============================================================================

CREATE TYPE cs_stock_move_kind AS ENUM ('in', 'out', 'transfer', 'adjust', 'waste');
CREATE TYPE cs_mreq_status AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'fulfilled', 'cancelled');

-- ============================================================================
-- MATERIALS — Malzeme master. waste_pct: standart fire oranı (%).
-- ============================================================================
CREATE TABLE cs_materials (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code        VARCHAR(40)  NOT NULL,
  name        VARCHAR(300) NOT NULL,
  unit        VARCHAR(20)  NOT NULL DEFAULT 'ad',
  waste_pct   NUMERIC(7, 4) NOT NULL DEFAULT 0 CHECK (waste_pct >= 0),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  INT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, code)
);

CREATE INDEX idx_cs_materials_company_active ON cs_materials(company_id, active);
CREATE TRIGGER cs_materials_updated_at BEFORE UPDATE ON cs_materials
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ============================================================================
-- WAREHOUSES — Depolar (projeye bağlı).
-- ============================================================================
CREATE TABLE cs_warehouses (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id  BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  code        VARCHAR(40)  NOT NULL,
  name        VARCHAR(200) NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, code)
);

CREATE INDEX idx_cs_warehouses_project ON cs_warehouses(project_id);
CREATE TRIGGER cs_warehouses_updated_at BEFORE UPDATE ON cs_warehouses
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ============================================================================
-- STOCK — Depo bazında malzeme stoğu (cache; hareketlerden güncellenir).
-- ============================================================================
CREATE TABLE cs_stock (
  id            BIGSERIAL PRIMARY KEY,
  company_id    INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  warehouse_id  BIGINT NOT NULL REFERENCES cs_warehouses(id) ON DELETE CASCADE,
  material_id   BIGINT NOT NULL REFERENCES cs_materials(id) ON DELETE CASCADE,
  qty           NUMERIC(20, 3) NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (warehouse_id, material_id)
);

CREATE INDEX idx_cs_stock_warehouse ON cs_stock(warehouse_id);

-- ============================================================================
-- STOCK MOVEMENTS — Giriş/çıkış/transfer/sayım/fire. boq_line_id: sarfiyatın
-- iş kalemi (maliyet dağıtımı). Stok cache transaction içinde güncellenir.
-- ============================================================================
CREATE TABLE cs_stock_movements (
  id              BIGSERIAL PRIMARY KEY,
  company_id      INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  material_id     BIGINT NOT NULL REFERENCES cs_materials(id) ON DELETE RESTRICT,
  kind            cs_stock_move_kind NOT NULL,
  from_warehouse  BIGINT REFERENCES cs_warehouses(id) ON DELETE SET NULL,
  to_warehouse    BIGINT REFERENCES cs_warehouses(id) ON DELETE SET NULL,
  qty             NUMERIC(20, 3) NOT NULL CHECK (qty >= 0),
  unit_cost       NUMERIC(20, 2) NOT NULL DEFAULT 0,
  boq_line_id     BIGINT REFERENCES cs_boq_lines(id) ON DELETE SET NULL,
  description     VARCHAR(500),
  moved_at        DATE NOT NULL,
  created_by      INT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cs_smv_material ON cs_stock_movements(material_id, moved_at);
CREATE INDEX idx_cs_smv_company ON cs_stock_movements(company_id, moved_at);

-- ============================================================================
-- MATERIAL REQUESTS — Malzeme talebi (header + lines). Onay görev ayrılığı.
-- ============================================================================
CREATE TABLE cs_material_requests (
  id            BIGSERIAL PRIMARY KEY,
  company_id    INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id    BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  req_no        VARCHAR(40) NOT NULL,
  status        cs_mreq_status NOT NULL DEFAULT 'draft',
  needed_by     DATE,
  note          TEXT,
  requested_by  INT REFERENCES users(id) ON DELETE SET NULL,
  approved_by   INT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, req_no)
);

CREATE INDEX idx_cs_mreq_project_status ON cs_material_requests(project_id, status);
CREATE TRIGGER cs_material_requests_updated_at BEFORE UPDATE ON cs_material_requests
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

CREATE TABLE cs_material_request_lines (
  id           BIGSERIAL PRIMARY KEY,
  request_id   BIGINT NOT NULL REFERENCES cs_material_requests(id) ON DELETE CASCADE,
  material_id  BIGINT NOT NULL REFERENCES cs_materials(id) ON DELETE RESTRICT,
  qty          NUMERIC(20, 3) NOT NULL DEFAULT 0 CHECK (qty >= 0),
  note         VARCHAR(500)
);

CREATE INDEX idx_cs_mrl_request ON cs_material_request_lines(request_id);
