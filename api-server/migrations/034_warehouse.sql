-- ============================================================================
-- 034_warehouse.sql — Depo & Stok Yönetimi (WMS — Warehouse Management System)
-- ----------------------------------------------------------------------------
-- modules/warehouse/ TS modülünün persistence katmanı.
--
-- Tablolar:
--   warehouses        → Depo (ambar) kartı + çoklu konum (locations JSONB)
--   materials         → Malzeme / stok kartı + alt birim & depo parametreleri (JSONB)
--   stock_movements   → Stok hareketi (in/out/transfer/count) + lot satırları (JSONB)
--
-- TASARIM KARARI (hareket-türevli stok):
--   Güncel stok ve maliyet SAKLANMAZ — her zaman stok_movements'tan StockLedger
--   ile türetilir (finance CashPositionCalculator ile aynı felsefe). Bu yüzden
--   ayrı bir bakiye/stok tablosu yoktur.
--
-- Çocuk koleksiyonlar (warehouse locations, material alt_units / wh_params,
-- movement lots) ayrı tablolar yerine JSONB kolonlarda saklanır: entity'ler
-- bunları aggregate olarak serialize eder (Warehouse.locations,
-- Material.altUnits/whParams, StockMovement.lots) ve replace mantığıyla yazılır.
--
-- Tüm tablolar company_id ile multi-tenant izole edilir. companies tablosu
-- (002_companies.sql) ve trg_updated_at() (001) yeniden kullanılır — burada
-- tekrar tanımlanmaz.
-- ============================================================================


-- ============================================================================
-- ENUM tipleri
-- ============================================================================
CREATE TYPE warehouse_status        AS ENUM ('active', 'passive');
CREATE TYPE location_status         AS ENUM ('active', 'passive', 'blocked');
CREATE TYPE material_status         AS ENUM ('active', 'passive');
CREATE TYPE material_track_method   AS ENUM ('none', 'lot', 'serial', 'serialGroup');
CREATE TYPE material_cost_method    AS ENUM ('avg', 'fifo', 'lifo', 'actual');
CREATE TYPE material_negative_control AS ENUM ('block', 'allow');
CREATE TYPE material_abc_class      AS ENUM ('A', 'B', 'C');
CREATE TYPE stock_movement_kind     AS ENUM ('in', 'out', 'transfer', 'count');


-- ============================================================================
-- WAREHOUSES — Depo (ambar) kartı
-- locations = çoklu konum hiyerarşisi (oda/koridor/raf/göz) JSONB dizisi:
--   [{ id, code, name, room, aisle, shelf, bin, status }]
-- ============================================================================
CREATE TABLE warehouses (
  id          SERIAL PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code        VARCHAR(60) NOT NULL,
  name        VARCHAR(200) NOT NULL,
  unit_name   VARCHAR(200),
  city        VARCHAR(100),
  district    VARCHAR(100),
  address     TEXT,
  manager     VARCHAR(200),
  status      warehouse_status NOT NULL DEFAULT 'active',
  locations   JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT warehouses_code_not_empty CHECK (length(trim(code)) > 0),
  CONSTRAINT warehouses_name_not_empty CHECK (length(trim(name)) > 0)
);

CREATE INDEX idx_warehouses_company_status
  ON warehouses(company_id, status);
CREATE UNIQUE INDEX uq_warehouses_company_code
  ON warehouses(company_id, lower(code));

CREATE TRIGGER warehouses_updated_at BEFORE UPDATE ON warehouses
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();


-- ============================================================================
-- MATERIALS — Malzeme / stok kartı
-- alt_units = alternatif birimler [{ unit, factor, barcode }] (1 alt = factor base)
-- wh_params = depo bazlı min/max/güvenlik stok + varsayılan konum
--             [{ warehouseId, minStock, maxStock, safetyStock, locationId }]
-- ============================================================================
CREATE TABLE materials (
  id                SERIAL PRIMARY KEY,
  company_id        INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code              VARCHAR(60) NOT NULL,
  name              VARCHAR(200) NOT NULL,
  group_id          INT,
  type              VARCHAR(60),
  base_unit         VARCHAR(40) NOT NULL,
  alt_units         JSONB NOT NULL DEFAULT '[]'::jsonb,
  brand             VARCHAR(120),
  barcode           VARCHAR(120),
  producer_code     VARCHAR(120),
  gtip              VARCHAR(40),
  abc               material_abc_class,
  track_method      material_track_method NOT NULL DEFAULT 'none',
  cost_method       material_cost_method NOT NULL DEFAULT 'avg',
  negative_control  material_negative_control NOT NULL DEFAULT 'block',
  min_stock         NUMERIC(20, 6),
  max_stock         NUMERIC(20, 6),
  safety_stock      NUMERIC(20, 6),
  shelf_life_months INT,
  perishable        BOOLEAN NOT NULL DEFAULT FALSE,
  fragile           BOOLEAN NOT NULL DEFAULT FALSE,
  kdv_purchase      NUMERIC(6, 2),
  kdv_sale          NUMERIC(6, 2),
  tevkifat_code     VARCHAR(40),
  extra_tax_rate    NUMERIC(10, 4),
  wh_params         JSONB NOT NULL DEFAULT '[]'::jsonb,
  status            material_status NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT materials_code_not_empty CHECK (length(trim(code)) > 0),
  CONSTRAINT materials_name_not_empty CHECK (length(trim(name)) > 0),
  CONSTRAINT materials_base_unit_not_empty CHECK (length(trim(base_unit)) > 0)
);

CREATE INDEX idx_materials_company_status
  ON materials(company_id, status);
CREATE INDEX idx_materials_company_group
  ON materials(company_id, group_id);
CREATE UNIQUE INDEX uq_materials_company_code
  ON materials(company_id, lower(code));

CREATE TRIGGER materials_updated_at BEFORE UPDATE ON materials
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();


-- ============================================================================
-- STOCK_MOVEMENTS — Stok hareketi (giriş/çıkış/transfer/sayım)
-- Stok HAREKET-TÜREVLİDİR: bakiye saklanmaz, bu satırlardan türetilir.
--   in       → +base_qty (warehouse_id)
--   out      → −base_qty (warehouse_id)
--   transfer → −base_qty (from_warehouse_id) / +base_qty (to_warehouse_id)
--   count    → işaretli düzeltme (warehouse_id; base_qty +/−)
-- base_qty = qty * factor (alt birimi base'e indirger).
-- lots = lot/parti satırları [{ no, qty, expiry }] (track_method=lot/serial).
-- ============================================================================
CREATE TABLE stock_movements (
  id                 SERIAL PRIMARY KEY,
  company_id         INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  no                 VARCHAR(60) NOT NULL,
  kind               stock_movement_kind NOT NULL,
  sub_type           VARCHAR(60),
  date               DATE NOT NULL,
  warehouse_id       INT REFERENCES warehouses(id) ON DELETE RESTRICT,
  from_warehouse_id  INT REFERENCES warehouses(id) ON DELETE RESTRICT,
  to_warehouse_id    INT REFERENCES warehouses(id) ON DELETE RESTRICT,
  material_id        INT NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  qty                NUMERIC(20, 6) NOT NULL,
  unit               VARCHAR(40) NOT NULL,
  factor             NUMERIC(20, 6) NOT NULL,
  base_unit          VARCHAR(40) NOT NULL,
  base_qty           NUMERIC(20, 6) NOT NULL,
  unit_price         NUMERIC(20, 4),
  unit_cost_base     NUMERIC(20, 6),
  total              NUMERIC(20, 4),
  lots               JSONB NOT NULL DEFAULT '[]'::jsonb,
  location_id        INT,
  party_id           INT,
  person             VARCHAR(200),
  doc_no             VARCHAR(120),
  note               TEXT,
  created_by         INT REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT stock_movements_no_not_empty CHECK (length(trim(no)) > 0),
  CONSTRAINT stock_movements_qty_pos CHECK (qty > 0),
  CONSTRAINT stock_movements_factor_pos CHECK (factor > 0),
  -- transfer: from/to dolu ve farklı; diğer türler: tek depo (warehouse_id) dolu
  CONSTRAINT stock_movements_warehouse_shape CHECK (
    (kind = 'transfer'
       AND from_warehouse_id IS NOT NULL
       AND to_warehouse_id IS NOT NULL
       AND from_warehouse_id <> to_warehouse_id)
    OR
    (kind <> 'transfer' AND warehouse_id IS NOT NULL)
  )
);

CREATE INDEX idx_stock_movements_company_material
  ON stock_movements(company_id, material_id);
CREATE INDEX idx_stock_movements_company_warehouse
  ON stock_movements(company_id, warehouse_id);
CREATE INDEX idx_stock_movements_company_from_wh
  ON stock_movements(company_id, from_warehouse_id);
CREATE INDEX idx_stock_movements_company_to_wh
  ON stock_movements(company_id, to_warehouse_id);
CREATE INDEX idx_stock_movements_company_kind_date
  ON stock_movements(company_id, kind, date);
CREATE UNIQUE INDEX uq_stock_movements_company_no
  ON stock_movements(company_id, no);


-- ============================================================================
-- Yorumlar (dökümantasyon)
-- ============================================================================
COMMENT ON TABLE warehouses IS
  'WMS: Depo (ambar) kartı. locations JSONB = çoklu konum hiyerarşisi (oda/koridor/raf/göz).';
COMMENT ON TABLE materials IS
  'WMS: Malzeme / stok kartı. alt_units = alternatif birimler (factor ile base''e dönüşür), wh_params = depo bazlı min/max/güvenlik stok.';
COMMENT ON TABLE stock_movements IS
  'WMS: Stok hareketi (in/out/transfer/count). Stok hareket-türevlidir — bakiye saklanmaz, bu satırlardan StockLedger ile türetilir.';
COMMENT ON COLUMN stock_movements.base_qty IS
  'qty * factor — alt birimi base birime indirger. Stok/maliyet hesabı bu kolon üzerinden yapılır.';

-- ============================================================================
-- /034_warehouse.sql
-- ============================================================================
