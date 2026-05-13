-- ============================================================================
-- 004_banks_kasa_transfers.sql
-- Promet CF — Banka hesapları, kasa hesapları, kasa girişleri, transferler
-- ============================================================================

CREATE TYPE currency_code AS ENUM ('TRY', 'USD', 'EUR');
CREATE TYPE flow_direction AS ENUM ('in', 'out');
CREATE TYPE endpoint_type AS ENUM ('bank', 'kasa');

-- ============================================================================
-- BANKS (sistem geneli banka listesi)
-- ============================================================================
CREATE TABLE banks (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  code       VARCHAR(20) NOT NULL UNIQUE,
  color      VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- BANK ACCOUNTS (şirket bazında)
-- ============================================================================
CREATE TABLE bank_accounts (
  id                 SERIAL PRIMARY KEY,
  company_id         INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bank_id            INT NOT NULL REFERENCES banks(id),
  name               VARCHAR(200) NOT NULL,
  iban               VARCHAR(34),
  account_no         VARCHAR(50),
  currency           currency_code NOT NULL DEFAULT 'TRY',
  opening_balance    NUMERIC(20, 2) NOT NULL DEFAULT 0,
  cashflow_cat_id    INT REFERENCES categories(id) ON DELETE SET NULL,
  active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_by         INT REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bank_accts_company ON bank_accounts(company_id) WHERE active = TRUE;
CREATE TRIGGER bank_accounts_updated_at BEFORE UPDATE ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ============================================================================
-- KASA ACCOUNTS
-- ============================================================================
CREATE TABLE kasa_accounts (
  id                 SERIAL PRIMARY KEY,
  company_id         INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name               VARCHAR(200) NOT NULL,
  currency           currency_code NOT NULL DEFAULT 'TRY',
  opening_balance    NUMERIC(20, 2) NOT NULL DEFAULT 0,
  active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_by         INT REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kasa_company ON kasa_accounts(company_id) WHERE active = TRUE;
CREATE TRIGGER kasa_accounts_updated_at BEFORE UPDATE ON kasa_accounts
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ============================================================================
-- KASA ENTRIES (kasa hareketleri)
-- ============================================================================
CREATE TABLE kasa_entries (
  id                 BIGSERIAL PRIMARY KEY,
  kasa_account_id    INT NOT NULL REFERENCES kasa_accounts(id) ON DELETE CASCADE,
  date               DATE NOT NULL,
  type               flow_direction NOT NULL,
  amount             NUMERIC(20, 2) NOT NULL CHECK (amount > 0),
  description        TEXT,
  category           VARCHAR(200),                  -- kasa kategori adı (free-form)
  cashflow_cat_id    INT REFERENCES categories(id) ON DELETE SET NULL,
  committed_to_cells BOOLEAN NOT NULL DEFAULT FALSE,
  committed_at       TIMESTAMPTZ,
  created_by         INT REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kasa_entries_account_date ON kasa_entries(kasa_account_id, date DESC);
CREATE INDEX idx_kasa_entries_pending ON kasa_entries(cashflow_cat_id, committed_to_cells)
  WHERE cashflow_cat_id IS NOT NULL AND committed_to_cells = FALSE;
CREATE TRIGGER kasa_entries_updated_at BEFORE UPDATE ON kasa_entries
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ============================================================================
-- TRANSFERS (banka↔kasa, banka↔banka, kasa↔kasa)
-- ============================================================================
CREATE TABLE transfers (
  id                 BIGSERIAL PRIMARY KEY,
  company_id         INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  date               DATE NOT NULL,
  from_type          endpoint_type NOT NULL,
  from_id            INT NOT NULL,                  -- bank_accounts.id veya kasa_accounts.id
  to_type            endpoint_type NOT NULL,
  to_id              INT NOT NULL,
  from_amount        NUMERIC(20, 2) NOT NULL CHECK (from_amount > 0),
  to_amount          NUMERIC(20, 2) NOT NULL CHECK (to_amount > 0),
  from_currency      currency_code NOT NULL,
  to_currency        currency_code NOT NULL,
  description        TEXT,
  cashflow_cat_id    INT REFERENCES categories(id) ON DELETE SET NULL,
  committed_to_cells BOOLEAN NOT NULL DEFAULT FALSE,
  committed_at       TIMESTAMPTZ,
  created_by         INT REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (NOT (from_type = to_type AND from_id = to_id))  -- aynı hesaba transfer yasak
);

CREATE INDEX idx_transfers_company_date ON transfers(company_id, date DESC);
CREATE INDEX idx_transfers_from ON transfers(from_type, from_id);
CREATE INDEX idx_transfers_to ON transfers(to_type, to_id);
CREATE INDEX idx_transfers_pending ON transfers(cashflow_cat_id, committed_to_cells)
  WHERE cashflow_cat_id IS NOT NULL AND committed_to_cells = FALSE;
CREATE TRIGGER transfers_updated_at BEFORE UPDATE ON transfers
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();
