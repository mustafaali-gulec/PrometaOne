-- ============================================================================
-- 025_cs_progress.sql
-- Prometa One — Şantiye Yönetim (Construction) Faz SF-3: Hakediş & İlerleme.
--
-- E4 bileşeni: Hakediş (işveren/taşeron, geçici/kesin), hakediş satırları
-- (BoQ kalemi bazında bu dönem/kümülatif), kesintiler, yeşil defter (kümülatif
-- metraj), ataşman (ölçü detayı) ve durum geçiş geçmişi (onay audit).
--
-- Hesap: grossThis = Σ this_amount; net_payable = grossThis + price_diff
--        + Σ(deduction.sign * deduction.amount). Durum makinesi:
--        draft → submitted → approved → paid ; reject → draft ; cancel.
-- ============================================================================

CREATE TYPE cs_progress_kind   AS ENUM ('employer', 'subcontractor');
CREATE TYPE cs_progress_type   AS ENUM ('interim', 'final');
CREATE TYPE cs_progress_status AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'paid', 'cancelled');
CREATE TYPE cs_deduction_kind  AS ENUM (
  'retention', 'advance_offset', 'sgk', 'income_tax', 'stoppage', 'penalty', 'price_diff', 'other'
);

-- ============================================================================
-- PROGRESS PAYMENTS — Hakediş başlığı.
-- ============================================================================
CREATE TABLE cs_progress_payments (
  id              BIGSERIAL PRIMARY KEY,
  company_id      INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contract_id     BIGINT NOT NULL REFERENCES cs_contracts(id) ON DELETE RESTRICT,
  hakedis_no      VARCHAR(40) NOT NULL,                 -- HAK-2026-0001
  kind            cs_progress_kind   NOT NULL,          -- employer | subcontractor
  ptype           cs_progress_type   NOT NULL DEFAULT 'interim',
  seq_no          INT NOT NULL,                         -- kaçıncı hakediş (kind bazında)
  period_start    DATE,
  period_end      DATE,
  status          cs_progress_status NOT NULL DEFAULT 'draft',
  gross_this      NUMERIC(20, 2) NOT NULL DEFAULT 0,    -- bu dönem yapılan iş
  gross_cumul     NUMERIC(20, 2) NOT NULL DEFAULT 0,    -- kümülatif yapılan iş
  price_diff      NUMERIC(20, 2) NOT NULL DEFAULT 0,    -- fiyat farkı (eskalasyon)
  deductions_tot  NUMERIC(20, 2) NOT NULL DEFAULT 0,    -- kesinti magnitüd toplamı
  net_payable     NUMERIC(20, 2) NOT NULL DEFAULT 0,    -- ödenecek net
  currency        currency_code NOT NULL DEFAULT 'TRY',
  submitted_at    TIMESTAMPTZ,
  approved_at     TIMESTAMPTZ,
  approved_by     INT REFERENCES users(id) ON DELETE SET NULL,
  created_by      INT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, hakedis_no),
  UNIQUE (contract_id, kind, seq_no)
);

CREATE INDEX idx_cs_pp_contract_status ON cs_progress_payments(contract_id, status);
CREATE TRIGGER cs_progress_payments_updated_at BEFORE UPDATE ON cs_progress_payments
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ============================================================================
-- PROGRESS LINES — Hakediş satırı (BoQ kalemi bazında).
-- ============================================================================
CREATE TABLE cs_progress_lines (
  id            BIGSERIAL PRIMARY KEY,
  progress_id   BIGINT NOT NULL REFERENCES cs_progress_payments(id) ON DELETE CASCADE,
  boq_line_id   BIGINT NOT NULL REFERENCES cs_boq_lines(id) ON DELETE RESTRICT,
  prev_qty      NUMERIC(20, 3) NOT NULL DEFAULT 0,      -- önceki kümülatif
  this_qty      NUMERIC(20, 3) NOT NULL DEFAULT 0,      -- bu dönem
  cumul_qty     NUMERIC(20, 3) NOT NULL DEFAULT 0,      -- prev + this
  unit_price    NUMERIC(20, 2) NOT NULL DEFAULT 0,
  this_amount   NUMERIC(20, 2) NOT NULL DEFAULT 0,
  cumul_amount  NUMERIC(20, 2) NOT NULL DEFAULT 0
);

CREATE INDEX idx_cs_pl_progress ON cs_progress_lines(progress_id);
CREATE INDEX idx_cs_pl_boq ON cs_progress_lines(boq_line_id);

-- ============================================================================
-- PROGRESS DEDUCTIONS — Kesintiler / ilaveler.
-- ============================================================================
CREATE TABLE cs_progress_deductions (
  id           BIGSERIAL PRIMARY KEY,
  progress_id  BIGINT NOT NULL REFERENCES cs_progress_payments(id) ON DELETE CASCADE,
  kind         cs_deduction_kind NOT NULL,
  label        VARCHAR(200),
  rate_pct     NUMERIC(7, 4),
  amount       NUMERIC(20, 2) NOT NULL DEFAULT 0,       -- magnitüd (pozitif)
  sign         SMALLINT NOT NULL DEFAULT -1             -- -1 kesinti, +1 ilave
);

CREATE INDEX idx_cs_pd_progress ON cs_progress_deductions(progress_id);

-- ============================================================================
-- MEASUREMENT BOOK — Yeşil defter (kümülatif metraj kaydı).
-- ============================================================================
CREATE TABLE cs_measurement_book (
  id            BIGSERIAL PRIMARY KEY,
  company_id    INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contract_id   BIGINT NOT NULL REFERENCES cs_contracts(id) ON DELETE CASCADE,
  boq_line_id   BIGINT NOT NULL REFERENCES cs_boq_lines(id) ON DELETE CASCADE,
  progress_id   BIGINT REFERENCES cs_progress_payments(id) ON DELETE SET NULL,
  measured_qty  NUMERIC(20, 3) NOT NULL DEFAULT 0,
  measured_at   DATE,
  note          TEXT,
  created_by    INT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cs_mb_contract ON cs_measurement_book(contract_id);
CREATE INDEX idx_cs_mb_boq ON cs_measurement_book(boq_line_id);

-- ============================================================================
-- ATTACHMENTS — Ataşman (ölçü detay sayfası / çizim eki).
-- ============================================================================
CREATE TABLE cs_attachments (
  id              BIGSERIAL PRIMARY KEY,
  company_id      INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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

-- ============================================================================
-- STATUS HISTORY — Hakediş durum geçiş geçmişi (onay audit).
-- ============================================================================
CREATE TABLE cs_progress_status_history (
  id            BIGSERIAL PRIMARY KEY,
  progress_id   BIGINT NOT NULL REFERENCES cs_progress_payments(id) ON DELETE CASCADE,
  from_status   cs_progress_status,
  to_status     cs_progress_status NOT NULL,
  actor_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cs_psh_progress ON cs_progress_status_history(progress_id);
