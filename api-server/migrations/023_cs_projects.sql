-- ============================================================================
-- 023_cs_projects.sql
-- Prometa One — Şantiye Yönetim (Construction) Faz SF-1: Proje & İhale.
--
-- E1 bileşeni: Projeler (özel/ihaleli), fiziksel şantiyeler, sözleşmeler
-- (işveren/taşeron), KİK/ihale bilgisi ve sözleşme dokümanları.
-- Karşı taraf cari = mevcut vendors tablosu (vendor_id FK).
-- ============================================================================

-- Statü / tip ENUM'ları
CREATE TYPE cs_project_type   AS ENUM ('private', 'public_tender');
CREATE TYPE cs_project_status AS ENUM ('planning', 'active', 'suspended', 'completed', 'closed');
CREATE TYPE cs_contract_party AS ENUM ('employer', 'subcontractor');

-- ============================================================================
-- PROJECTS — Proje (özel veya ihaleli). budget_amount keşif öncesi tahmini /
-- onaylı bütçe; keşif (BoQ) geldiğinde sözleşme bedeli ile kıyaslanır.
-- ============================================================================
CREATE TABLE cs_projects (
  id              BIGSERIAL PRIMARY KEY,
  company_id      INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code            VARCHAR(40)  NOT NULL,
  name            VARCHAR(300) NOT NULL,
  project_type    cs_project_type   NOT NULL DEFAULT 'private',
  status          cs_project_status NOT NULL DEFAULT 'planning',
  org_unit_id     INT,                                   -- HR org birimi (gevşek bağ, FK yok)
  manager_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  location        VARCHAR(500),
  start_date      DATE,
  planned_end     DATE,
  budget_amount   NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (budget_amount >= 0),
  currency        currency_code  NOT NULL DEFAULT 'TRY',
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      INT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, code)
);

CREATE INDEX idx_cs_projects_company_status ON cs_projects(company_id, status);
CREATE INDEX idx_cs_projects_manager ON cs_projects(manager_user_id);
CREATE TRIGGER cs_projects_updated_at BEFORE UPDATE ON cs_projects
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ============================================================================
-- SITES — Bir proje altında 1+ fiziksel şantiye (depo/puantaj kırılımı için).
-- ============================================================================
CREATE TABLE cs_sites (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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
CREATE TRIGGER cs_sites_updated_at BEFORE UPDATE ON cs_sites
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ============================================================================
-- CONTRACTS — Sözleşme. party_kind=employer (biz yüklenici, gelir) veya
-- subcontractor (biz idare, gider). vendor_id karşı taraf cari (vendors).
-- retention_pct teminat/kesinti, advance_pct avans oranı.
-- ============================================================================
CREATE TABLE cs_contracts (
  id              BIGSERIAL PRIMARY KEY,
  company_id      INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id      BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  party_kind      cs_contract_party NOT NULL,
  vendor_id       BIGINT REFERENCES vendors(id) ON DELETE RESTRICT,
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
  created_by      INT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, contract_no)
);

CREATE INDEX idx_cs_contracts_project ON cs_contracts(project_id);
CREATE INDEX idx_cs_contracts_vendor ON cs_contracts(vendor_id);
CREATE TRIGGER cs_contracts_updated_at BEFORE UPDATE ON cs_contracts
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ============================================================================
-- TENDER INFO — Yalnızca KİK/ihaleli sözleşmeler (1-1). EKAP/İKN, usul,
-- yaklaşık maliyet, iş artışı tavanı (%10/%20), kesin teminat oranı.
-- ============================================================================
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

-- ============================================================================
-- CONTRACT DOCUMENTS — İdari/teknik şartname, sözleşme, ek belgeler.
-- ============================================================================
CREATE TABLE cs_contract_documents (
  id           BIGSERIAL PRIMARY KEY,
  company_id   INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contract_id  BIGINT NOT NULL REFERENCES cs_contracts(id) ON DELETE CASCADE,
  doc_type     VARCHAR(40)  NOT NULL DEFAULT 'ek',  -- idari_sartname|teknik_sartname|sozlesme|ek
  title        VARCHAR(300) NOT NULL,
  file_url     VARCHAR(1000),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cs_contract_docs_contract ON cs_contract_documents(contract_id);
