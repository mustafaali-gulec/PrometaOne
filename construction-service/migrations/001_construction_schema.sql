-- ============================================================================
-- 001_construction_schema.sql — Construction Service (DB-per-service)
--
-- Monolitteki cs_* tablolarının (api-server migration 023-028) bu servisin
-- KENDİ veritabanına taşınmış halidir. Tek fark: companies/users/vendors/
-- invoices'a olan FK'ler KALDIRILDI — bunlar artık başka servislerin sahip
-- olduğu dış varlıklardır ve burada "soft reference" (FK'siz id) tutulur.
-- cs_* tablolar arası FK'ler korunur (bu DB'nin sahipliğinde).
-- ============================================================================

-- Para birimi (monolitteki currency_code ENUM'unun kopyası)
CREATE TYPE currency_code AS ENUM ('TRY', 'USD', 'EUR');

-- updated_at trigger fonksiyonu (monolitteki ile aynı)
CREATE OR REPLACE FUNCTION trg_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ENUM'lar
CREATE TYPE cs_project_type   AS ENUM ('private', 'public_tender');
CREATE TYPE cs_project_status AS ENUM ('planning', 'active', 'suspended', 'completed', 'closed');
CREATE TYPE cs_contract_party AS ENUM ('employer', 'subcontractor');
CREATE TYPE cs_progress_kind   AS ENUM ('employer', 'subcontractor');
CREATE TYPE cs_progress_type   AS ENUM ('interim', 'final');
CREATE TYPE cs_progress_status AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'paid', 'cancelled');
CREATE TYPE cs_deduction_kind  AS ENUM ('retention', 'advance_offset', 'sgk', 'income_tax', 'stoppage', 'penalty', 'price_diff', 'other');
CREATE TYPE cs_stock_move_kind AS ENUM ('in', 'out', 'transfer', 'adjust', 'waste');
CREATE TYPE cs_mreq_status     AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'fulfilled', 'cancelled');
CREATE TYPE cs_machine_kind    AS ENUM ('owned', 'rented', 'subcontractor');

-- ============================================================================
-- E1 — PROJE & İHALE  (company_id/manager_user_id/created_by → soft ref)
-- ============================================================================
CREATE TABLE cs_projects (
  id              BIGSERIAL PRIMARY KEY,
  company_id      INT NOT NULL,                       -- soft ref → companies
  code            VARCHAR(40)  NOT NULL,
  name            VARCHAR(300) NOT NULL,
  project_type    cs_project_type   NOT NULL DEFAULT 'private',
  status          cs_project_status NOT NULL DEFAULT 'planning',
  org_unit_id     INT,
  manager_user_id INT,                                -- soft ref → users
  location        VARCHAR(500),
  start_date      DATE,
  planned_end     DATE,
  budget_amount   NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (budget_amount >= 0),
  currency        currency_code  NOT NULL DEFAULT 'TRY',
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      INT,                                -- soft ref → users
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, code)
);
CREATE INDEX idx_cs_projects_company_status ON cs_projects(company_id, status);
CREATE TRIGGER cs_projects_updated_at BEFORE UPDATE ON cs_projects FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

CREATE TABLE cs_sites (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INT NOT NULL,
  project_id  BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  code        VARCHAR(40)  NOT NULL,
  name        VARCHAR(300) NOT NULL,
  location    VARCHAR(500),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, project_id, code)
);
CREATE INDEX idx_cs_sites_project ON cs_sites(project_id);
CREATE TRIGGER cs_sites_updated_at BEFORE UPDATE ON cs_sites FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

CREATE TABLE cs_contracts (
  id              BIGSERIAL PRIMARY KEY,
  company_id      INT NOT NULL,
  project_id      BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  party_kind      cs_contract_party NOT NULL,
  vendor_id       BIGINT,                             -- soft ref → vendors
  contract_no     VARCHAR(60)  NOT NULL,
  title           VARCHAR(300) NOT NULL,
  amount          NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency        currency_code  NOT NULL DEFAULT 'TRY',
  sign_date       DATE,
  start_date      DATE,
  end_date        DATE,
  retention_pct   NUMERIC(7, 4) NOT NULL DEFAULT 0 CHECK (retention_pct >= 0),
  advance_pct     NUMERIC(7, 4) NOT NULL DEFAULT 0 CHECK (advance_pct >= 0),
  price_diff_on   BOOLEAN NOT NULL DEFAULT FALSE,
  created_by      INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, contract_no)
);
CREATE INDEX idx_cs_contracts_project ON cs_contracts(project_id);
CREATE INDEX idx_cs_contracts_vendor ON cs_contracts(vendor_id);
CREATE TRIGGER cs_contracts_updated_at BEFORE UPDATE ON cs_contracts FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

CREATE TABLE cs_tender_info (
  contract_id       BIGINT PRIMARY KEY REFERENCES cs_contracts(id) ON DELETE CASCADE,
  ikn               VARCHAR(40),
  procedure         VARCHAR(60),
  approx_cost       NUMERIC(20, 2),
  tender_date       DATE,
  work_increase_pct NUMERIC(7, 4) NOT NULL DEFAULT 0,
  perf_bond_pct     NUMERIC(7, 4) NOT NULL DEFAULT 0,
  notes             TEXT
);

CREATE TABLE cs_contract_documents (
  id           BIGSERIAL PRIMARY KEY,
  company_id   INT NOT NULL,
  contract_id  BIGINT NOT NULL REFERENCES cs_contracts(id) ON DELETE CASCADE,
  doc_type     VARCHAR(40)  NOT NULL DEFAULT 'ek',
  title        VARCHAR(300) NOT NULL,
  file_url     VARCHAR(1000),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cs_contract_docs_contract ON cs_contract_documents(contract_id);

-- ============================================================================
-- E2 — KEŞİF & PURSANTAJ
-- ============================================================================
CREATE TABLE cs_poz_catalog (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INT NOT NULL,
  poz_no      VARCHAR(40)  NOT NULL,
  name        VARCHAR(500) NOT NULL,
  unit        VARCHAR(20)  NOT NULL,
  unit_price  NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  source      VARCHAR(40),
  year        INT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, poz_no, year)
);
CREATE INDEX idx_cs_poz_company_active ON cs_poz_catalog(company_id, active);
CREATE TRIGGER cs_poz_catalog_updated_at BEFORE UPDATE ON cs_poz_catalog FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

CREATE TABLE cs_boq_groups (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INT NOT NULL,
  contract_id BIGINT NOT NULL REFERENCES cs_contracts(id) ON DELETE CASCADE,
  code        VARCHAR(40)  NOT NULL,
  name        VARCHAR(300) NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_cs_boq_groups_contract ON cs_boq_groups(contract_id);

CREATE TABLE cs_boq_lines (
  id            BIGSERIAL PRIMARY KEY,
  company_id    INT NOT NULL,
  contract_id   BIGINT NOT NULL REFERENCES cs_contracts(id) ON DELETE CASCADE,
  group_id      BIGINT REFERENCES cs_boq_groups(id) ON DELETE SET NULL,
  poz_id        BIGINT REFERENCES cs_poz_catalog(id) ON DELETE SET NULL,
  line_no       INT NOT NULL DEFAULT 1,
  poz_no        VARCHAR(40),
  description   VARCHAR(500) NOT NULL,
  unit          VARCHAR(20)  NOT NULL DEFAULT 'ad',
  quantity      NUMERIC(20, 3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit_price    NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  amount        NUMERIC(20, 2) NOT NULL DEFAULT 0,
  pursantaj_pct NUMERIC(9, 6)  NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, contract_id, line_no)
);
CREATE INDEX idx_cs_boq_lines_contract ON cs_boq_lines(contract_id);
CREATE TRIGGER cs_boq_lines_updated_at BEFORE UPDATE ON cs_boq_lines FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ============================================================================
-- E4 — HAKEDİŞ, YEŞİL DEFTER, ATAŞMAN
-- ============================================================================
CREATE TABLE cs_progress_payments (
  id              BIGSERIAL PRIMARY KEY,
  company_id      INT NOT NULL,
  contract_id     BIGINT NOT NULL REFERENCES cs_contracts(id) ON DELETE RESTRICT,
  hakedis_no      VARCHAR(40) NOT NULL,
  kind            cs_progress_kind   NOT NULL,
  ptype           cs_progress_type   NOT NULL DEFAULT 'interim',
  seq_no          INT NOT NULL,
  period_start    DATE,
  period_end      DATE,
  status          cs_progress_status NOT NULL DEFAULT 'draft',
  gross_this      NUMERIC(20, 2) NOT NULL DEFAULT 0,
  gross_cumul     NUMERIC(20, 2) NOT NULL DEFAULT 0,
  price_diff      NUMERIC(20, 2) NOT NULL DEFAULT 0,
  deductions_tot  NUMERIC(20, 2) NOT NULL DEFAULT 0,
  net_payable     NUMERIC(20, 2) NOT NULL DEFAULT 0,
  currency        currency_code NOT NULL DEFAULT 'TRY',
  submitted_at    TIMESTAMPTZ,
  approved_at     TIMESTAMPTZ,
  approved_by     INT,                                -- soft ref → users
  created_by      INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, hakedis_no),
  UNIQUE (contract_id, kind, seq_no)
);
CREATE INDEX idx_cs_pp_contract_status ON cs_progress_payments(contract_id, status);
CREATE TRIGGER cs_progress_payments_updated_at BEFORE UPDATE ON cs_progress_payments FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

CREATE TABLE cs_progress_lines (
  id            BIGSERIAL PRIMARY KEY,
  progress_id   BIGINT NOT NULL REFERENCES cs_progress_payments(id) ON DELETE CASCADE,
  boq_line_id   BIGINT NOT NULL REFERENCES cs_boq_lines(id) ON DELETE RESTRICT,
  prev_qty      NUMERIC(20, 3) NOT NULL DEFAULT 0,
  this_qty      NUMERIC(20, 3) NOT NULL DEFAULT 0,
  cumul_qty     NUMERIC(20, 3) NOT NULL DEFAULT 0,
  unit_price    NUMERIC(20, 2) NOT NULL DEFAULT 0,
  this_amount   NUMERIC(20, 2) NOT NULL DEFAULT 0,
  cumul_amount  NUMERIC(20, 2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_cs_pl_progress ON cs_progress_lines(progress_id);
CREATE INDEX idx_cs_pl_boq ON cs_progress_lines(boq_line_id);

CREATE TABLE cs_progress_deductions (
  id           BIGSERIAL PRIMARY KEY,
  progress_id  BIGINT NOT NULL REFERENCES cs_progress_payments(id) ON DELETE CASCADE,
  kind         cs_deduction_kind NOT NULL,
  label        VARCHAR(200),
  rate_pct     NUMERIC(7, 4),
  amount       NUMERIC(20, 2) NOT NULL DEFAULT 0,
  sign         SMALLINT NOT NULL DEFAULT -1
);
CREATE INDEX idx_cs_pd_progress ON cs_progress_deductions(progress_id);

CREATE TABLE cs_measurement_book (
  id            BIGSERIAL PRIMARY KEY,
  company_id    INT NOT NULL,
  contract_id   BIGINT NOT NULL REFERENCES cs_contracts(id) ON DELETE CASCADE,
  boq_line_id   BIGINT NOT NULL REFERENCES cs_boq_lines(id) ON DELETE CASCADE,
  progress_id   BIGINT REFERENCES cs_progress_payments(id) ON DELETE SET NULL,
  measured_qty  NUMERIC(20, 3) NOT NULL DEFAULT 0,
  measured_at   DATE,
  note          TEXT,
  created_by    INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cs_mb_contract ON cs_measurement_book(contract_id);
CREATE INDEX idx_cs_mb_boq ON cs_measurement_book(boq_line_id);

CREATE TABLE cs_attachments (
  id              BIGSERIAL PRIMARY KEY,
  company_id      INT NOT NULL,
  measurement_id  BIGINT REFERENCES cs_measurement_book(id) ON DELETE CASCADE,
  boq_line_id     BIGINT REFERENCES cs_boq_lines(id) ON DELETE CASCADE,
  formula         VARCHAR(500),
  dim_a           NUMERIC(20, 3),
  dim_b           NUMERIC(20, 3),
  dim_c           NUMERIC(20, 3),
  count_n         NUMERIC(20, 3) DEFAULT 1,
  result_qty      NUMERIC(20, 3) NOT NULL DEFAULT 0,
  file_url        VARCHAR(1000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cs_att_measurement ON cs_attachments(measurement_id);

CREATE TABLE cs_progress_status_history (
  id            BIGSERIAL PRIMARY KEY,
  progress_id   BIGINT NOT NULL REFERENCES cs_progress_payments(id) ON DELETE CASCADE,
  from_status   cs_progress_status,
  to_status     cs_progress_status NOT NULL,
  actor_user_id INT,                                  -- soft ref → users
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cs_psh_progress ON cs_progress_status_history(progress_id);

-- ============================================================================
-- E3 — HARCAMA & FİNANS
-- ============================================================================
CREATE TABLE cs_expenses (
  id            BIGSERIAL PRIMARY KEY,
  company_id    INT NOT NULL,
  project_id    BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  boq_line_id   BIGINT REFERENCES cs_boq_lines(id) ON DELETE SET NULL,
  vendor_id     BIGINT,                               -- soft ref → vendors
  invoice_id    BIGINT,                               -- soft ref → invoices
  category      VARCHAR(40)  NOT NULL DEFAULT 'other',
  description   VARCHAR(500),
  amount        NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency      currency_code NOT NULL DEFAULT 'TRY',
  spent_at      DATE NOT NULL,
  created_by    INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cs_expenses_project ON cs_expenses(project_id);
CREATE INDEX idx_cs_expenses_boq ON cs_expenses(boq_line_id) WHERE boq_line_id IS NOT NULL;
CREATE TRIGGER cs_expenses_updated_at BEFORE UPDATE ON cs_expenses FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

CREATE TABLE cs_advances (
  id            BIGSERIAL PRIMARY KEY,
  company_id    INT NOT NULL,
  project_id    BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  vendor_id     BIGINT,
  description   VARCHAR(500),
  amount        NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  offset_amount NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (offset_amount >= 0),
  currency      currency_code NOT NULL DEFAULT 'TRY',
  given_at      DATE NOT NULL,
  created_by    INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cs_advances_project ON cs_advances(project_id);
CREATE TRIGGER cs_advances_updated_at BEFORE UPDATE ON cs_advances FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

CREATE TABLE cs_cash_movements (
  id                  BIGSERIAL PRIMARY KEY,
  company_id          INT NOT NULL,
  project_id          BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  direction           SMALLINT NOT NULL DEFAULT -1,
  account_ref         VARCHAR(60),
  description         VARCHAR(500),
  amount              NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency            currency_code NOT NULL DEFAULT 'TRY',
  moved_at            DATE NOT NULL,
  related_progress_id BIGINT REFERENCES cs_progress_payments(id) ON DELETE SET NULL,
  created_by          INT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cs_cash_project ON cs_cash_movements(project_id);
CREATE TRIGGER cs_cash_movements_updated_at BEFORE UPDATE ON cs_cash_movements FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ============================================================================
-- E5 — MALZEME & DEPO
-- ============================================================================
CREATE TABLE cs_materials (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INT NOT NULL,
  code        VARCHAR(40)  NOT NULL,
  name        VARCHAR(300) NOT NULL,
  unit        VARCHAR(20)  NOT NULL DEFAULT 'ad',
  waste_pct   NUMERIC(7, 4) NOT NULL DEFAULT 0 CHECK (waste_pct >= 0),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, code)
);
CREATE INDEX idx_cs_materials_company_active ON cs_materials(company_id, active);
CREATE TRIGGER cs_materials_updated_at BEFORE UPDATE ON cs_materials FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

CREATE TABLE cs_warehouses (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INT NOT NULL,
  project_id  BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  code        VARCHAR(40)  NOT NULL,
  name        VARCHAR(200) NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, code)
);
CREATE INDEX idx_cs_warehouses_project ON cs_warehouses(project_id);
CREATE TRIGGER cs_warehouses_updated_at BEFORE UPDATE ON cs_warehouses FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

CREATE TABLE cs_stock (
  id            BIGSERIAL PRIMARY KEY,
  company_id    INT NOT NULL,
  warehouse_id  BIGINT NOT NULL REFERENCES cs_warehouses(id) ON DELETE CASCADE,
  material_id   BIGINT NOT NULL REFERENCES cs_materials(id) ON DELETE CASCADE,
  qty           NUMERIC(20, 3) NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (warehouse_id, material_id)
);
CREATE INDEX idx_cs_stock_warehouse ON cs_stock(warehouse_id);

CREATE TABLE cs_stock_movements (
  id              BIGSERIAL PRIMARY KEY,
  company_id      INT NOT NULL,
  material_id     BIGINT NOT NULL REFERENCES cs_materials(id) ON DELETE RESTRICT,
  kind            cs_stock_move_kind NOT NULL,
  from_warehouse  BIGINT REFERENCES cs_warehouses(id) ON DELETE SET NULL,
  to_warehouse    BIGINT REFERENCES cs_warehouses(id) ON DELETE SET NULL,
  qty             NUMERIC(20, 3) NOT NULL CHECK (qty >= 0),
  unit_cost       NUMERIC(20, 2) NOT NULL DEFAULT 0,
  boq_line_id     BIGINT REFERENCES cs_boq_lines(id) ON DELETE SET NULL,
  description     VARCHAR(500),
  moved_at        DATE NOT NULL,
  created_by      INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cs_smv_material ON cs_stock_movements(material_id, moved_at);
CREATE INDEX idx_cs_smv_company ON cs_stock_movements(company_id, moved_at);

CREATE TABLE cs_material_requests (
  id            BIGSERIAL PRIMARY KEY,
  company_id    INT NOT NULL,
  project_id    BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  req_no        VARCHAR(40) NOT NULL,
  status        cs_mreq_status NOT NULL DEFAULT 'draft',
  needed_by     DATE,
  note          TEXT,
  requested_by  INT,                                  -- soft ref → users
  approved_by   INT,                                  -- soft ref → users
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, req_no)
);
CREATE INDEX idx_cs_mreq_project_status ON cs_material_requests(project_id, status);
CREATE TRIGGER cs_material_requests_updated_at BEFORE UPDATE ON cs_material_requests FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

CREATE TABLE cs_material_request_lines (
  id           BIGSERIAL PRIMARY KEY,
  request_id   BIGINT NOT NULL REFERENCES cs_material_requests(id) ON DELETE CASCADE,
  material_id  BIGINT NOT NULL REFERENCES cs_materials(id) ON DELETE RESTRICT,
  qty          NUMERIC(20, 3) NOT NULL DEFAULT 0 CHECK (qty >= 0),
  note         VARCHAR(500)
);
CREATE INDEX idx_cs_mrl_request ON cs_material_request_lines(request_id);

-- ============================================================================
-- E6 — İŞ GÜCÜ & MAKİNE
-- ============================================================================
CREATE TABLE cs_personnel (
  id               BIGSERIAL PRIMARY KEY,
  company_id       INT NOT NULL,
  project_id       BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  employee_id      BIGINT,                            -- soft ref → HR employees
  vendor_id        BIGINT,                            -- soft ref → vendors (taşeron)
  full_name        VARCHAR(200) NOT NULL,
  trade            VARCHAR(80),
  daily_cost       NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (daily_cost >= 0),
  is_subcontractor BOOLEAN NOT NULL DEFAULT FALSE,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_by       INT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cs_personnel_project ON cs_personnel(project_id);
CREATE TRIGGER cs_personnel_updated_at BEFORE UPDATE ON cs_personnel FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

CREATE TABLE cs_timesheets (
  id            BIGSERIAL PRIMARY KEY,
  company_id    INT NOT NULL,
  personnel_id  BIGINT NOT NULL REFERENCES cs_personnel(id) ON DELETE CASCADE,
  work_date     DATE NOT NULL,
  hours         NUMERIC(6, 2) NOT NULL DEFAULT 0 CHECK (hours >= 0),
  overtime      NUMERIC(6, 2) NOT NULL DEFAULT 0 CHECK (overtime >= 0),
  status_code   VARCHAR(10) NOT NULL DEFAULT 'P',
  boq_line_id   BIGINT REFERENCES cs_boq_lines(id) ON DELETE SET NULL,
  created_by    INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (personnel_id, work_date)
);
CREATE INDEX idx_cs_ts_date ON cs_timesheets(company_id, work_date);
CREATE TRIGGER cs_timesheets_updated_at BEFORE UPDATE ON cs_timesheets FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

CREATE TABLE cs_machines (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INT NOT NULL,
  code        VARCHAR(40)  NOT NULL,
  name        VARCHAR(200) NOT NULL,
  kind        cs_machine_kind NOT NULL DEFAULT 'owned',
  vendor_id   BIGINT,                                 -- soft ref → vendors
  hourly_cost NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (hourly_cost >= 0),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, code)
);
CREATE INDEX idx_cs_machines_company_active ON cs_machines(company_id, active);
CREATE TRIGGER cs_machines_updated_at BEFORE UPDATE ON cs_machines FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

CREATE TABLE cs_machine_logs (
  id            BIGSERIAL PRIMARY KEY,
  company_id    INT NOT NULL,
  machine_id    BIGINT NOT NULL REFERENCES cs_machines(id) ON DELETE CASCADE,
  project_id    BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  log_date      DATE NOT NULL,
  work_hours    NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (work_hours >= 0),
  fuel_liters   NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (fuel_liters >= 0),
  fuel_cost     NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (fuel_cost >= 0),
  maint_cost    NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (maint_cost >= 0),
  boq_line_id   BIGINT REFERENCES cs_boq_lines(id) ON DELETE SET NULL,
  note          VARCHAR(500),
  created_by    INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cs_mlog_project ON cs_machine_logs(project_id, log_date);
CREATE INDEX idx_cs_mlog_machine ON cs_machine_logs(machine_id);
