-- ============================================================================
-- 030_expense_cards.sql
-- Prometa One — Gider/Masraf modülü: Gider Kartları (expense_cards) ana verisi.
-- Gider kartı kalıcı bir master kayıttır (kod GKxxxx). Kasa Excel import'undan
-- ya da elle oluşturulur. flow_direction enum'u (in/out) ve trg_updated_at()
-- fonksiyonu zaten var (004 / 001) — yeniden oluşturulmaz, tekrar kullanılır.
-- ============================================================================

CREATE TABLE expense_cards (
  id                   BIGSERIAL PRIMARY KEY,
  company_id           INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code                 VARCHAR(40)  NOT NULL,
  name                 VARCHAR(300) NOT NULL,
  category             VARCHAR(120) NOT NULL DEFAULT '',
  direction            flow_direction NOT NULL DEFAULT 'out',
  default_account_code VARCHAR(40),
  note                 TEXT,
  active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_by           INT REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, code)
);

CREATE INDEX idx_expense_cards_company_active ON expense_cards(company_id, active);
CREATE TRIGGER expense_cards_updated_at BEFORE UPDATE ON expense_cards
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();
