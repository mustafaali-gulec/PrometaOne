-- ============================================================================
-- 022_purchasing.sql
-- Prometa One — Satınalma (Purchasing): Tedarikçiler (cari), Talepler (PR),
-- Siparişler (PO). Tedarikçi kalıcı bir cari kaydıdır (kod 320.x) ve PO ona
-- vendor_id FK ile bağlanır (cari hesap ilişkisi).
-- ============================================================================

-- Statü ENUM'ları
CREATE TYPE pr_status AS ENUM (
  'draft', 'pending_approval', 'approved', 'rejected', 'ordered', 'received', 'closed'
);
CREATE TYPE po_status AS ENUM (
  'draft', 'ordered', 'partial', 'received', 'closed', 'cancelled', 'invoiced'
);

-- ============================================================================
-- VENDORS — Tedarikçi (kalıcı cari). cari_class genelde 'satici' (320).
-- account_code: muhasebe/cari hesap kodu (örn 320.01.A001) — cari hesap linki.
-- ============================================================================
CREATE TABLE vendors (
  id            BIGSERIAL PRIMARY KEY,
  company_id    INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code          VARCHAR(40) NOT NULL,                 -- cari kodu, örn 320.A001
  name          VARCHAR(300) NOT NULL,
  tax_id        VARCHAR(20),                          -- VKN / TCKN
  person_type   VARCHAR(10) NOT NULL DEFAULT 'legal', -- real | legal
  cari_class    VARCHAR(10) NOT NULL DEFAULT 'satici',-- satici | alici
  account_code  VARCHAR(40),                          -- GL/cari hesap kodu (320.x)
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    INT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, code)
);

CREATE INDEX idx_vendors_company_active ON vendors(company_id, active);
CREATE INDEX idx_vendors_name ON vendors(company_id, name);
CREATE TRIGGER vendors_updated_at BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ============================================================================
-- PURCHASE REQUESTS — Satınalma talepleri (PR)
-- ============================================================================
CREATE TABLE purchase_requests (
  id                BIGSERIAL PRIMARY KEY,
  company_id        INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  pr_no             VARCHAR(40) NOT NULL,
  requester_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  department_id     INT,                              -- HR org birimi (gevşek bağ, FK yok)
  category          VARCHAR(40) NOT NULL DEFAULT 'other',
  priority          VARCHAR(20) NOT NULL DEFAULT 'normal',
  status            pr_status NOT NULL DEFAULT 'draft',
  currency          currency_code NOT NULL DEFAULT 'TRY',
  total_amount      NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  justification     TEXT,
  required_by       DATE,
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, pr_no)
);

CREATE INDEX idx_pr_company_status ON purchase_requests(company_id, status);
CREATE INDEX idx_pr_requester ON purchase_requests(company_id, requester_user_id);
CREATE TRIGGER purchase_requests_updated_at BEFORE UPDATE ON purchase_requests
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

CREATE TABLE purchase_request_items (
  id          BIGSERIAL PRIMARY KEY,
  pr_id       BIGINT NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  line_no     INT NOT NULL DEFAULT 1,
  description VARCHAR(500) NOT NULL,
  quantity    NUMERIC(20, 3) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit_price  NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  note        TEXT
);

CREATE INDEX idx_pr_items_pr ON purchase_request_items(pr_id);

-- ============================================================================
-- PURCHASE ORDERS — Satınalma siparişleri (PO). vendor_id zorunlu (cari linki).
-- ============================================================================
CREATE TABLE purchase_orders (
  id            BIGSERIAL PRIMARY KEY,
  company_id    INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  po_no         VARCHAR(40) NOT NULL,
  vendor_id     BIGINT NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  pr_id         BIGINT REFERENCES purchase_requests(id) ON DELETE SET NULL,
  status        po_status NOT NULL DEFAULT 'draft',
  currency      currency_code NOT NULL DEFAULT 'TRY',
  total_amount  NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  ordered_at    TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  note          TEXT,
  created_by    INT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, po_no)
);

CREATE INDEX idx_po_company_status ON purchase_orders(company_id, status);
CREATE INDEX idx_po_vendor ON purchase_orders(vendor_id);
CREATE INDEX idx_po_pr ON purchase_orders(pr_id) WHERE pr_id IS NOT NULL;
CREATE TRIGGER purchase_orders_updated_at BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

CREATE TABLE purchase_order_lines (
  id           BIGSERIAL PRIMARY KEY,
  po_id        BIGINT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  line_no      INT NOT NULL DEFAULT 1,
  description  VARCHAR(500) NOT NULL,
  quantity     NUMERIC(20, 3) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  received_qty NUMERIC(20, 3) NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
  unit_price   NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0)
);

CREATE INDEX idx_po_lines_po ON purchase_order_lines(po_id);
