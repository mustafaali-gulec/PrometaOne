-- ============================================================================
-- 035_warehouse_aux.sql — Depo & Stok yardımcı (aux) tabloları (WMS Faz 2)
-- ----------------------------------------------------------------------------
-- 034_warehouse.sql üzerine modules/warehouse/ modülünün genişletilmiş
-- entity'lerinin persistence katmanı.
--
-- Tablolar:
--   material_groups    → Malzeme grubu (referans kartı)
--   units              → Ölçü birimi kataloğu (referans kartı)
--   variants           → Varyant tanımı + seçenekler (options JSONB)
--   material_requests  → Malzeme Talep + kalemler (items JSONB) — iş akışı
--   inventory_counts   → Envanter Sayım + kalemler (items JSONB) — iş akışı
--   assignments        → Zimmet + kalemler (items JSONB) — iş akışı
--
-- TASARIM KARARI (034 ile aynı):
--   Çocuk koleksiyonlar (variant options, request/count/assignment items) ayrı
--   tablolar yerine JSONB kolonlarda saklanır; entity'ler bunları aggregate
--   olarak serialize eder ve replace mantığıyla yazar. İş akışı belgelerinin
--   stok etkisi (talep karşılama / sayım uygulama / zimmet) stock_movements
--   tablosuna OUT/IN/count hareketleri olarak işlenir (hareket-türevli stok).
--
-- Tüm tablolar company_id ile multi-tenant izole edilir. companies (002),
-- trg_updated_at() (001) ve warehouses/materials (034) yeniden kullanılır —
-- burada tekrar tanımlanmaz.
-- ============================================================================


-- ============================================================================
-- ENUM tipleri
-- ============================================================================
CREATE TYPE group_status            AS ENUM ('active', 'passive');
CREATE TYPE variant_status          AS ENUM ('active', 'passive');
CREATE TYPE material_request_status  AS ENUM ('pending', 'approved', 'rejected', 'fulfilled');
CREATE TYPE inventory_count_status   AS ENUM ('open', 'applied');
CREATE TYPE assignment_status        AS ENUM ('open', 'returned');


-- ============================================================================
-- MATERIAL_GROUPS — Malzeme grubu (referans kartı)
-- ============================================================================
CREATE TABLE material_groups (
  id          SERIAL PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code        VARCHAR(60) NOT NULL,
  name        VARCHAR(200) NOT NULL,
  status      group_status NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT material_groups_code_not_empty CHECK (length(trim(code)) > 0),
  CONSTRAINT material_groups_name_not_empty CHECK (length(trim(name)) > 0)
);

CREATE INDEX idx_material_groups_company_status
  ON material_groups(company_id, status);
CREATE UNIQUE INDEX uq_material_groups_company_code
  ON material_groups(company_id, lower(code));

CREATE TRIGGER material_groups_updated_at BEFORE UPDATE ON material_groups
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();


-- ============================================================================
-- UNITS — Ölçü birimi kataloğu (referans kartı)
-- ============================================================================
CREATE TABLE units (
  id          SERIAL PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code        VARCHAR(60) NOT NULL,
  name        VARCHAR(200) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT units_code_not_empty CHECK (length(trim(code)) > 0),
  CONSTRAINT units_name_not_empty CHECK (length(trim(name)) > 0)
);

CREATE INDEX idx_units_company ON units(company_id);
CREATE UNIQUE INDEX uq_units_company_code
  ON units(company_id, lower(code));

CREATE TRIGGER units_updated_at BEFORE UPDATE ON units
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();


-- ============================================================================
-- VARIANTS — Varyant tanımı (renk/beden/model vb.)
-- options = varyant seçenekleri [{ code, name }] JSONB dizisi
-- ============================================================================
CREATE TABLE variants (
  id          SERIAL PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code        VARCHAR(60) NOT NULL,
  name        VARCHAR(200) NOT NULL,
  status      variant_status NOT NULL DEFAULT 'active',
  options     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT variants_code_not_empty CHECK (length(trim(code)) > 0),
  CONSTRAINT variants_name_not_empty CHECK (length(trim(name)) > 0)
);

CREATE INDEX idx_variants_company_status
  ON variants(company_id, status);
CREATE UNIQUE INDEX uq_variants_company_code
  ON variants(company_id, lower(code));

CREATE TRIGGER variants_updated_at BEFORE UPDATE ON variants
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();


-- ============================================================================
-- MATERIAL_REQUESTS — Malzeme Talep (iş akışı)
-- items = talep kalemleri [{ materialId, qty, unit }] JSONB dizisi
-- İş akışı: pending → approved → fulfilled (veya → rejected). fulfilled olunca
-- requested_warehouse_id'den her kalem için stock_movements'a OUT hareketi
-- (sub_type=kullanima_verme) yazılır.
-- ============================================================================
CREATE TABLE material_requests (
  id                     SERIAL PRIMARY KEY,
  company_id             INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  no                     VARCHAR(60) NOT NULL,
  date                   DATE NOT NULL,
  requester_unit         VARCHAR(200),
  requester              VARCHAR(200),
  requested_warehouse_id INT REFERENCES warehouses(id) ON DELETE RESTRICT,
  validity_days          INT,
  status                 material_request_status NOT NULL DEFAULT 'pending',
  items                  JSONB NOT NULL DEFAULT '[]'::jsonb,
  note                   TEXT,
  reject_reason          TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT material_requests_no_not_empty CHECK (length(trim(no)) > 0)
);

CREATE INDEX idx_material_requests_company_status
  ON material_requests(company_id, status);
CREATE INDEX idx_material_requests_company_date
  ON material_requests(company_id, date);
CREATE UNIQUE INDEX uq_material_requests_company_no
  ON material_requests(company_id, no);

CREATE TRIGGER material_requests_updated_at BEFORE UPDATE ON material_requests
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();


-- ============================================================================
-- INVENTORY_COUNTS — Envanter Sayım (iş akışı)
-- items = sayım kalemleri [{ materialId, systemQty, countedQty }] JSONB dizisi
-- İş akışı: open → applied. applied olunca farklı kalemler için stock_movements'a
-- `count` türünde işaretli hareket (base_qty = countedQty − systemQty) yazılır.
-- ============================================================================
CREATE TABLE inventory_counts (
  id           SERIAL PRIMARY KEY,
  company_id   INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  no           VARCHAR(60) NOT NULL,
  date         DATE NOT NULL,
  warehouse_id INT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  period       VARCHAR(60),
  status       inventory_count_status NOT NULL DEFAULT 'open',
  items        JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT inventory_counts_no_not_empty CHECK (length(trim(no)) > 0)
);

CREATE INDEX idx_inventory_counts_company_status
  ON inventory_counts(company_id, status);
CREATE INDEX idx_inventory_counts_company_warehouse
  ON inventory_counts(company_id, warehouse_id);
CREATE UNIQUE INDEX uq_inventory_counts_company_no
  ON inventory_counts(company_id, no);

CREATE TRIGGER inventory_counts_updated_at BEFORE UPDATE ON inventory_counts
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();


-- ============================================================================
-- ASSIGNMENTS — Zimmet (iş akışı)
-- items = zimmet kalemleri [{ materialId, warehouseId, qty }] JSONB dizisi
-- İş akışı: open → returned. create her kalem için OUT (sub_type=zimmet),
-- return her kalem için IN (sub_type=zimmet_iade) hareketi yazar.
-- ============================================================================
CREATE TABLE assignments (
  id          SERIAL PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  no          VARCHAR(60) NOT NULL,
  date        DATE NOT NULL,
  person      VARCHAR(200),
  birim       VARCHAR(200),
  status      assignment_status NOT NULL DEFAULT 'open',
  items       JSONB NOT NULL DEFAULT '[]'::jsonb,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT assignments_no_not_empty CHECK (length(trim(no)) > 0)
);

CREATE INDEX idx_assignments_company_status
  ON assignments(company_id, status);
CREATE INDEX idx_assignments_company_date
  ON assignments(company_id, date);
CREATE UNIQUE INDEX uq_assignments_company_no
  ON assignments(company_id, no);

CREATE TRIGGER assignments_updated_at BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();


-- ============================================================================
-- Yorumlar (dökümantasyon)
-- ============================================================================
COMMENT ON TABLE material_groups IS
  'WMS: Malzeme grubu (referans kartı). materials.group_id ile bağlanır.';
COMMENT ON TABLE units IS
  'WMS: Ölçü birimi kataloğu (referans kartı / öneri listesi).';
COMMENT ON TABLE variants IS
  'WMS: Varyant tanımı. options JSONB = varyant seçenekleri [{code, name}].';
COMMENT ON TABLE material_requests IS
  'WMS: Malzeme Talep (iş akışı). fulfilled → requested_warehouse_id''den OUT hareketi (sub_type=kullanima_verme).';
COMMENT ON TABLE inventory_counts IS
  'WMS: Envanter Sayım (iş akışı). applied → farklı kalemler için count hareketi (base_qty = countedQty − systemQty).';
COMMENT ON TABLE assignments IS
  'WMS: Zimmet (iş akışı). create → OUT (sub_type=zimmet), return → IN (sub_type=zimmet_iade).';

-- ============================================================================
-- /035_warehouse_aux.sql
-- ============================================================================
