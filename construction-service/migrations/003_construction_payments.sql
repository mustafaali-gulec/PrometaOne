-- Manuel ödeme kayıtları (Ödeme Listesi). Birleşik liste manuel + hakediş + gider + avans.
CREATE TABLE cs_payments (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INT NOT NULL,
  project_id  BIGINT REFERENCES cs_projects(id) ON DELETE SET NULL,
  payee       VARCHAR(300),
  description VARCHAR(500),
  amount      NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency    currency_code NOT NULL DEFAULT 'TRY',
  due_date    DATE,
  status      VARCHAR(20) NOT NULL DEFAULT 'planned',  -- planned | paid
  paid_at     DATE,
  method      VARCHAR(40),
  created_by  INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cs_payments_company ON cs_payments(company_id);
CREATE TRIGGER cs_payments_updated_at BEFORE UPDATE ON cs_payments FOR EACH ROW EXECUTE FUNCTION trg_updated_at();
