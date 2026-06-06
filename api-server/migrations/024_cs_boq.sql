-- ============================================================================
-- 024_cs_boq.sql
-- Prometa One — Şantiye Yönetim (Construction) Faz SF-2: Keşif & Pursantaj.
--
-- E2 bileşeni: Poz katalog (birim fiyat pozları), imalat grupları ve keşif
-- (BoQ) satırları. Pursantaj (% ağırlık) uygulamada hesaplanıp saklanır:
--   pursantaj_pct = amount / SUM(amount)  (sözleşme bazında, toplam = 100)
-- BoQ bir sözleşmeye (cs_contracts) bağlıdır.
-- ============================================================================

-- ============================================================================
-- POZ CATALOG — Birim fiyat / poz katalog (firma genel, yeniden kullanılır).
-- ============================================================================
CREATE TABLE cs_poz_catalog (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  poz_no      VARCHAR(40)  NOT NULL,                 -- ör. Y.16.050/01
  name        VARCHAR(500) NOT NULL,
  unit        VARCHAR(20)  NOT NULL,                 -- m3, m2, ton, ad …
  unit_price  NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  source      VARCHAR(40),                           -- CSB | kurum | ozel
  year        INT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  INT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, poz_no, year)
);

CREATE INDEX idx_cs_poz_company_active ON cs_poz_catalog(company_id, active);
CREATE INDEX idx_cs_poz_name ON cs_poz_catalog(company_id, name);
CREATE TRIGGER cs_poz_catalog_updated_at BEFORE UPDATE ON cs_poz_catalog
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ============================================================================
-- BOQ GROUPS — İmalat grupları (pursantaj roll-up için, opsiyonel).
-- ============================================================================
CREATE TABLE cs_boq_groups (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contract_id BIGINT NOT NULL REFERENCES cs_contracts(id) ON DELETE CASCADE,
  code        VARCHAR(40)  NOT NULL,
  name        VARCHAR(300) NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_cs_boq_groups_contract ON cs_boq_groups(contract_id);

-- ============================================================================
-- BOQ LINES — Keşif satırı (iş kalemi). amount = quantity*unit_price (uygulamada
-- hesap), pursantaj_pct sözleşme bazında normalize edilir.
-- ============================================================================
CREATE TABLE cs_boq_lines (
  id            BIGSERIAL PRIMARY KEY,
  company_id    INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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
CREATE INDEX idx_cs_boq_lines_poz ON cs_boq_lines(poz_id) WHERE poz_id IS NOT NULL;
CREATE TRIGGER cs_boq_lines_updated_at BEFORE UPDATE ON cs_boq_lines
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();
