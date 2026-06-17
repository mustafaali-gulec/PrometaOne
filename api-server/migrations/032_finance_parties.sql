-- ============================================================================
-- 032_finance_parties.sql
-- Cari kartları (müşteri / tedarikçi / personel / ortak ...) kalıcı deposu.
--
-- Frontend'in zengin cari objesi `data` JSONB kolonunda tam olarak saklanır;
-- sorgulanabilir alanlar (code, name, type, tax_id, status) denormalize edilir.
-- Bulk-import use-case (company_id, code) UNIQUE üzerinden idempotent upsert yapar.
-- ============================================================================

CREATE TABLE IF NOT EXISTS finance_parties (
  id            TEXT PRIMARY KEY,
  company_id    INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code          TEXT NOT NULL,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,
  person_type   TEXT,
  tax_id        TEXT,
  status        TEXT NOT NULL DEFAULT 'active',
  data          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_finance_parties_company ON finance_parties(company_id);
CREATE INDEX IF NOT EXISTS idx_finance_parties_taxid ON finance_parties(company_id, tax_id);

CREATE TRIGGER finance_parties_updated_at BEFORE UPDATE ON finance_parties
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ============================================================================
-- /032_finance_parties.sql
-- ============================================================================
