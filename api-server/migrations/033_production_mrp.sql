-- ============================================================================
-- 033_production_mrp.sql — Üretim & MRP (Malzeme İhtiyaç Planlama)
-- ----------------------------------------------------------------------------
-- modules/production/ TS modülünün persistence katmanı.
--
-- Tablolar:
--   production_boms             → Ürün Ağacı / Reçete (BOM) başlığı
--   production_bom_components   → Reçete bileşenleri (malzeme satırları)
--   production_bom_operations   → Reçete operasyonları (iş merkezi rotası)
--   production_work_centers     → İş Merkezi / İstasyon
--   production_orders           → Üretim Emri
--   production_order_materials  → Üretim emri malzeme rezervasyonu/tüketimi
--   production_order_operations → Üretim emri operasyonları
--   production_mrp_runs         → MRP koşusu snapshot'ı (sonuç JSONB)
--
-- ÖNEMLİ KARAR (WMS bağımlılığı):
--   WMS (Depo/Stok) modülünün henüz backend'i yok; stok kartları frontend'de
--   `mat_...` opaque string id ile yaşıyor. Bu yüzden malzeme referansları FK
--   ile bir materials tablosuna BAĞLANMAZ — `material_ref TEXT` kolonlarında
--   serbest string olarak saklanır. Depo referansı da `warehouse_ref TEXT`.
--
-- Tüm tablolar company_id ile multi-tenant izole edilir.
-- companies tablosu (002_companies.sql) ve trg_updated_at() (001) yeniden
-- kullanılır — burada tekrar tanımlanmaz.
-- ============================================================================


-- ============================================================================
-- ENUM tipleri
-- ============================================================================
CREATE TYPE production_bom_status AS ENUM ('active', 'draft', 'passive');
CREATE TYPE production_wc_status AS ENUM ('active', 'passive');
CREATE TYPE production_order_status AS ENUM (
  'planned', 'released', 'in_progress', 'completed', 'cancelled'
);
CREATE TYPE production_order_priority AS ENUM ('low', 'normal', 'high');
CREATE TYPE production_order_source AS ENUM ('manual', 'mrp');
CREATE TYPE production_order_op_status AS ENUM ('pending', 'done');


-- ============================================================================
-- WORK_CENTERS — İş Merkezi / İstasyon (kapasite ve maliyet kaynağı)
-- ============================================================================
CREATE TABLE production_work_centers (
  id            SERIAL PRIMARY KEY,
  company_id    INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code          VARCHAR(40) NOT NULL,
  name          VARCHAR(200) NOT NULL,
  daily_hours   NUMERIC(10, 2) NOT NULL DEFAULT 8,
  cost_per_hour NUMERIC(20, 4) NOT NULL DEFAULT 0,
  status        production_wc_status NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT production_wc_code_not_empty CHECK (length(trim(code)) > 0),
  CONSTRAINT production_wc_name_not_empty CHECK (length(trim(name)) > 0),
  CONSTRAINT production_wc_daily_hours_nonneg CHECK (daily_hours >= 0),
  CONSTRAINT production_wc_cost_nonneg CHECK (cost_per_hour >= 0)
);

CREATE INDEX idx_production_wc_company_status
  ON production_work_centers(company_id, status);
CREATE UNIQUE INDEX uq_production_wc_company_code
  ON production_work_centers(company_id, code);

CREATE TRIGGER production_work_centers_updated_at BEFORE UPDATE ON production_work_centers
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();


-- ============================================================================
-- BOMS — Ürün Ağacı / Reçete başlığı
-- product_material_ref = üretilen mamul (WMS stok kartı opaque id'si)
-- ============================================================================
CREATE TABLE production_boms (
  id                   SERIAL PRIMARY KEY,
  company_id           INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  no                   VARCHAR(60) NOT NULL,
  product_material_ref TEXT NOT NULL,
  name                 VARCHAR(200) NOT NULL,
  output_qty           NUMERIC(20, 4) NOT NULL DEFAULT 1,
  output_unit          VARCHAR(20),
  version              VARCHAR(40),
  status               production_bom_status NOT NULL DEFAULT 'draft',
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT production_boms_no_not_empty CHECK (length(trim(no)) > 0),
  CONSTRAINT production_boms_name_not_empty CHECK (length(trim(name)) > 0),
  CONSTRAINT production_boms_product_ref_not_empty CHECK (length(trim(product_material_ref)) > 0),
  CONSTRAINT production_boms_output_qty_pos CHECK (output_qty > 0)
);

CREATE INDEX idx_production_boms_company_status
  ON production_boms(company_id, status);
CREATE INDEX idx_production_boms_company_product
  ON production_boms(company_id, product_material_ref);
CREATE UNIQUE INDEX uq_production_boms_company_no
  ON production_boms(company_id, no);

CREATE TRIGGER production_boms_updated_at BEFORE UPDATE ON production_boms
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();


-- ============================================================================
-- BOM_COMPONENTS — Reçete bileşenleri (malzeme satırları)
-- is_semi = bu bileşen kendisi de üretiliyor mu (yarı mamul → çok seviyeli)
-- ============================================================================
CREATE TABLE production_bom_components (
  id            SERIAL PRIMARY KEY,
  bom_id        INT NOT NULL REFERENCES production_boms(id) ON DELETE CASCADE,
  material_ref  TEXT NOT NULL,
  qty           NUMERIC(20, 4) NOT NULL,
  unit          VARCHAR(20),
  scrap_pct     NUMERIC(10, 4) NOT NULL DEFAULT 0,
  is_semi       BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order    INT NOT NULL DEFAULT 0,

  CONSTRAINT production_bom_comp_ref_not_empty CHECK (length(trim(material_ref)) > 0),
  CONSTRAINT production_bom_comp_qty_pos CHECK (qty > 0),
  CONSTRAINT production_bom_comp_scrap_nonneg CHECK (scrap_pct >= 0)
);

CREATE INDEX idx_production_bom_comp_bom
  ON production_bom_components(bom_id, sort_order);

-- (Trigger gerekmiyor: updated_at kolonu yok — bileşenler reçeteyle birlikte
--  yeniden yazılır.)


-- ============================================================================
-- BOM_OPERATIONS — Reçete operasyonları (iş merkezi rotası)
-- work_center_id NULL olabilir (henüz atanmamış operasyon)
-- ============================================================================
CREATE TABLE production_bom_operations (
  id               SERIAL PRIMARY KEY,
  bom_id           INT NOT NULL REFERENCES production_boms(id) ON DELETE CASCADE,
  work_center_id   INT REFERENCES production_work_centers(id) ON DELETE SET NULL,
  name             VARCHAR(200) NOT NULL,
  setup_min        NUMERIC(20, 4) NOT NULL DEFAULT 0,
  run_min_per_unit NUMERIC(20, 4) NOT NULL DEFAULT 0,
  seq              INT NOT NULL DEFAULT 0,

  CONSTRAINT production_bom_op_name_not_empty CHECK (length(trim(name)) > 0),
  CONSTRAINT production_bom_op_setup_nonneg CHECK (setup_min >= 0),
  CONSTRAINT production_bom_op_run_nonneg CHECK (run_min_per_unit >= 0)
);

CREATE INDEX idx_production_bom_op_bom
  ON production_bom_operations(bom_id, seq);


-- ============================================================================
-- ORDERS — Üretim Emri
-- bom_id NULL olabilir (reçetesiz, manuel emir).
-- warehouse_ref = WMS depo opaque id'si (TEXT).
-- cost_snapshot = tamamlanma anındaki maliyet dökümü (JSONB).
-- ============================================================================
CREATE TABLE production_orders (
  id                   SERIAL PRIMARY KEY,
  company_id           INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  no                   VARCHAR(60) NOT NULL,
  bom_id               INT REFERENCES production_boms(id) ON DELETE SET NULL,
  product_material_ref TEXT NOT NULL,
  qty                  NUMERIC(20, 4) NOT NULL,
  unit                 VARCHAR(20),
  status               production_order_status NOT NULL DEFAULT 'planned',
  planned_start        DATE,
  planned_end          DATE,
  warehouse_ref        TEXT,
  priority             production_order_priority NOT NULL DEFAULT 'normal',
  source               production_order_source NOT NULL DEFAULT 'manual',
  produced_qty         NUMERIC(20, 4) NOT NULL DEFAULT 0,
  scrap_qty            NUMERIC(20, 4) NOT NULL DEFAULT 0,
  cost_snapshot        JSONB,
  consumed             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at         TIMESTAMPTZ,

  CONSTRAINT production_orders_no_not_empty CHECK (length(trim(no)) > 0),
  CONSTRAINT production_orders_product_ref_not_empty CHECK (length(trim(product_material_ref)) > 0),
  CONSTRAINT production_orders_qty_pos CHECK (qty > 0),
  CONSTRAINT production_orders_produced_nonneg CHECK (produced_qty >= 0),
  CONSTRAINT production_orders_scrap_nonneg CHECK (scrap_qty >= 0),
  CONSTRAINT production_orders_dates_order
    CHECK (planned_start IS NULL OR planned_end IS NULL OR planned_end >= planned_start)
);

CREATE INDEX idx_production_orders_company_status
  ON production_orders(company_id, status);
CREATE INDEX idx_production_orders_company_product
  ON production_orders(company_id, product_material_ref);
CREATE INDEX idx_production_orders_bom
  ON production_orders(bom_id);
CREATE UNIQUE INDEX uq_production_orders_company_no
  ON production_orders(company_id, no);

CREATE TRIGGER production_orders_updated_at BEFORE UPDATE ON production_orders
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();


-- ============================================================================
-- ORDER_MATERIALS — üretim emri malzeme rezervasyonu / tüketimi
-- ============================================================================
CREATE TABLE production_order_materials (
  id            SERIAL PRIMARY KEY,
  order_id      INT NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  material_ref  TEXT NOT NULL,
  required_qty  NUMERIC(20, 4) NOT NULL,
  unit          VARCHAR(20),
  consumed_qty  NUMERIC(20, 4) NOT NULL DEFAULT 0,

  CONSTRAINT production_order_mat_ref_not_empty CHECK (length(trim(material_ref)) > 0),
  CONSTRAINT production_order_mat_required_nonneg CHECK (required_qty >= 0),
  CONSTRAINT production_order_mat_consumed_nonneg CHECK (consumed_qty >= 0)
);

CREATE INDEX idx_production_order_mat_order
  ON production_order_materials(order_id);


-- ============================================================================
-- ORDER_OPERATIONS — üretim emri operasyonları
-- ============================================================================
CREATE TABLE production_order_operations (
  id             SERIAL PRIMARY KEY,
  order_id       INT NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  work_center_id INT REFERENCES production_work_centers(id) ON DELETE SET NULL,
  name           VARCHAR(200) NOT NULL,
  planned_min    NUMERIC(20, 4) NOT NULL DEFAULT 0,
  status         production_order_op_status NOT NULL DEFAULT 'pending',
  seq            INT NOT NULL DEFAULT 0,

  CONSTRAINT production_order_op_name_not_empty CHECK (length(trim(name)) > 0),
  CONSTRAINT production_order_op_planned_nonneg CHECK (planned_min >= 0)
);

CREATE INDEX idx_production_order_op_order
  ON production_order_operations(order_id, seq);


-- ============================================================================
-- MRP_RUNS — MRP koşusu snapshot'ı
-- params = istek parametreleri, result = hesaplanan plan (purchase/production/
-- shortages/capacityLoad/summary). Tüm plan JSONB olarak saklanır.
-- ============================================================================
CREATE TABLE production_mrp_runs (
  id          SERIAL PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  no          VARCHAR(60) NOT NULL,
  run_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  params      JSONB NOT NULL DEFAULT '{}'::jsonb,
  result      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT production_mrp_runs_no_not_empty CHECK (length(trim(no)) > 0)
);

CREATE INDEX idx_production_mrp_runs_company
  ON production_mrp_runs(company_id, run_at DESC);


-- ============================================================================
-- Yorumlar (dökümantasyon)
-- ============================================================================
COMMENT ON TABLE production_work_centers IS
  'Üretim: İş Merkezi / İstasyon — kapasite (daily_hours) ve maliyet (cost_per_hour) kaynağı.';
COMMENT ON TABLE production_boms IS
  'Üretim: Ürün Ağacı / Reçete başlığı. product_material_ref = WMS stok kartı opaque id (FK yok).';
COMMENT ON TABLE production_bom_components IS
  'Üretim: Reçete bileşenleri. is_semi=TRUE → yarı mamul (çok seviyeli patlatma).';
COMMENT ON TABLE production_bom_operations IS
  'Üretim: Reçete operasyon rotası. setup_min + run_min_per_unit × qty = operasyon süresi.';
COMMENT ON TABLE production_orders IS
  'Üretim: Üretim Emri. warehouse_ref = WMS depo opaque id (FK yok). cost_snapshot = tamamlanma maliyeti.';
COMMENT ON TABLE production_order_materials IS
  'Üretim: Üretim emri malzeme rezervasyonu/tüketimi (BOM patlatmasından üretilir).';
COMMENT ON TABLE production_order_operations IS
  'Üretim: Üretim emri operasyonları (reçeteden kopyalanır).';
COMMENT ON TABLE production_mrp_runs IS
  'Üretim: MRP koşusu snapshot''ı. result JSONB = hesaplanan plan (purchase/production/shortages/capacity).';

-- ============================================================================
-- /033_production_mrp.sql
-- ============================================================================
