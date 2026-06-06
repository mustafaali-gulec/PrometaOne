-- ============================================================================
-- 026_cs_finance.sql
-- Prometa One — Şantiye Yönetim (Construction) Faz SF-4: Harcama & Finans.
--
-- E3 bileşeni: Şantiye giderleri (projeye + opsiyonel keşif kalemine dağıtım),
-- avanslar (hakedişten mahsup), kasa/banka hareketleri. Gider mevcut fatura
-- kaydına (finance.invoices) gevşek invoice_id ile bağlanabilir (FK yok).
-- ============================================================================

-- ============================================================================
-- EXPENSES — Şantiye giderleri. category: malzeme|iscilik|makine|genel|other.
-- boq_line_id verilirse maliyet o iş kalemine dağıtılır (bütçe-gerçekleşen).
-- ============================================================================
CREATE TABLE cs_expenses (
  id            BIGSERIAL PRIMARY KEY,
  company_id    INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id    BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  boq_line_id   BIGINT REFERENCES cs_boq_lines(id) ON DELETE SET NULL,
  vendor_id     BIGINT REFERENCES vendors(id) ON DELETE SET NULL,
  invoice_id    BIGINT,                                -- finance.invoices (gevşek bağ, FK yok)
  category      VARCHAR(40)  NOT NULL DEFAULT 'other',
  description   VARCHAR(500),
  amount        NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency      currency_code NOT NULL DEFAULT 'TRY',
  spent_at      DATE NOT NULL,
  created_by    INT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cs_expenses_project ON cs_expenses(project_id);
CREATE INDEX idx_cs_expenses_boq ON cs_expenses(boq_line_id) WHERE boq_line_id IS NOT NULL;
CREATE TRIGGER cs_expenses_updated_at BEFORE UPDATE ON cs_expenses
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ============================================================================
-- ADVANCES — Avanslar (personel/taşeron/proje). offset_amount: hakedişten
-- mahsup edilen kümülatif tutar.
-- ============================================================================
CREATE TABLE cs_advances (
  id            BIGSERIAL PRIMARY KEY,
  company_id    INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id    BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  vendor_id     BIGINT REFERENCES vendors(id) ON DELETE SET NULL,
  description   VARCHAR(500),
  amount        NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  offset_amount NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (offset_amount >= 0),
  currency      currency_code NOT NULL DEFAULT 'TRY',
  given_at      DATE NOT NULL,
  created_by    INT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cs_advances_project ON cs_advances(project_id);
CREATE TRIGGER cs_advances_updated_at BEFORE UPDATE ON cs_advances
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ============================================================================
-- CASH MOVEMENTS — Kasa/banka hareketi (şantiye). direction: +1 tahsilat, -1 tediye.
-- ============================================================================
CREATE TABLE cs_cash_movements (
  id                  BIGSERIAL PRIMARY KEY,
  company_id          INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id          BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  direction           SMALLINT NOT NULL DEFAULT -1,     -- +1 tahsilat, -1 tediye
  account_ref         VARCHAR(60),                       -- kasa/banka referansı
  description         VARCHAR(500),
  amount              NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency            currency_code NOT NULL DEFAULT 'TRY',
  moved_at            DATE NOT NULL,
  related_progress_id BIGINT REFERENCES cs_progress_payments(id) ON DELETE SET NULL,
  created_by          INT REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cs_cash_project ON cs_cash_movements(project_id);
CREATE TRIGGER cs_cash_movements_updated_at BEFORE UPDATE ON cs_cash_movements
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();
