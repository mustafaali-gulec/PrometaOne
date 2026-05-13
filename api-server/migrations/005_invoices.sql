-- ============================================================================
-- 005_invoices.sql
-- Promet CF — Faturalar (AR/AP) ve ödemeler
-- ============================================================================

CREATE TABLE invoices (
  id                 BIGSERIAL PRIMARY KEY,
  company_id         INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type               flow_direction NOT NULL,         -- in=gelen/borç, out=giden/alacak
  invoice_no         VARCHAR(80),
  counterparty       VARCHAR(300) NOT NULL,
  issue_date         DATE,
  due_date           DATE NOT NULL,
  currency           currency_code NOT NULL DEFAULT 'TRY',
  subtotal           NUMERIC(20, 2) NOT NULL DEFAULT 0,
  kdv_rate           NUMERIC(5, 4) NOT NULL DEFAULT 0.20,
  kdv                NUMERIC(20, 2) NOT NULL DEFAULT 0,
  total              NUMERIC(20, 2) NOT NULL CHECK (total > 0),
  paid_amount        NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  cashflow_cat_id    INT REFERENCES categories(id) ON DELETE SET NULL,
  committed_to_cells BOOLEAN NOT NULL DEFAULT FALSE,
  committed_at       TIMESTAMPTZ,
  note               TEXT,
  created_by         INT REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (paid_amount <= total + 0.01)               -- yuvarlama toleransı
);

CREATE INDEX idx_invoices_company_due ON invoices(company_id, due_date);
CREATE INDEX idx_invoices_type ON invoices(company_id, type);
CREATE INDEX idx_invoices_counterparty ON invoices(company_id, counterparty);
CREATE INDEX idx_invoices_pending ON invoices(cashflow_cat_id, committed_to_cells)
  WHERE cashflow_cat_id IS NOT NULL AND committed_to_cells = FALSE;
CREATE INDEX idx_invoices_open ON invoices(company_id, due_date)
  WHERE paid_amount < total;
CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ============================================================================
-- INVOICE PAYMENTS
-- ============================================================================
CREATE TABLE invoice_payments (
  id                 BIGSERIAL PRIMARY KEY,
  invoice_id         BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount             NUMERIC(20, 2) NOT NULL CHECK (amount > 0),
  date               DATE NOT NULL,
  currency           currency_code NOT NULL,
  bank_account_id    INT REFERENCES bank_accounts(id) ON DELETE SET NULL,
  kasa_account_id    INT REFERENCES kasa_accounts(id) ON DELETE SET NULL,
  note               TEXT,
  created_by         INT REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (bank_account_id IS NOT NULL AND kasa_account_id IS NULL) OR
    (bank_account_id IS NULL AND kasa_account_id IS NOT NULL) OR
    (bank_account_id IS NULL AND kasa_account_id IS NULL)
  )
);

CREATE INDEX idx_invoice_pmt_invoice ON invoice_payments(invoice_id);
CREATE INDEX idx_invoice_pmt_date ON invoice_payments(date);
CREATE INDEX idx_invoice_pmt_bank ON invoice_payments(bank_account_id)
  WHERE bank_account_id IS NOT NULL;
CREATE INDEX idx_invoice_pmt_kasa ON invoice_payments(kasa_account_id)
  WHERE kasa_account_id IS NOT NULL;

-- ============================================================================
-- Trigger: ödeme eklenince/silinince invoices.paid_amount güncelle
-- ============================================================================
CREATE OR REPLACE FUNCTION update_invoice_paid_amount()
RETURNS TRIGGER AS $$
DECLARE
  inv_id BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    inv_id := OLD.invoice_id;
  ELSE
    inv_id := NEW.invoice_id;
  END IF;

  UPDATE invoices
  SET paid_amount = COALESCE(
    (SELECT SUM(amount) FROM invoice_payments WHERE invoice_id = inv_id),
    0
  )
  WHERE id = inv_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_payments_aiud
  AFTER INSERT OR UPDATE OR DELETE ON invoice_payments
  FOR EACH ROW EXECUTE FUNCTION update_invoice_paid_amount();

-- ============================================================================
-- View: fatura durumu (open/partial/paid/overdue)
-- ============================================================================
CREATE OR REPLACE VIEW v_invoice_status AS
SELECT
  i.*,
  CASE
    WHEN i.paid_amount >= i.total - 0.01 THEN 'paid'
    WHEN i.paid_amount > 0 THEN 'partial'
    WHEN i.due_date < CURRENT_DATE THEN 'overdue'
    ELSE 'open'
  END AS status,
  (i.total - i.paid_amount) AS remaining
FROM invoices i;
