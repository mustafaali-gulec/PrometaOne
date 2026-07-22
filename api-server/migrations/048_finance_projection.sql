-- ============================================================================
-- 048_finance_projection.sql — Blob FİNANS çekirdeği → normalize finance
--                               tabloları projeksiyon kimlik kolonları (client_id)
-- ----------------------------------------------------------------------------
-- DÖRDÜNCÜ app-state fan-out projeksiyonu (emsaller: 046_access_projection.sql,
-- 047_hr_projection.sql). PUT /v1/app-state/promet:data sonrası
-- FinanceProjection + PgFinanceProjectionRepository blob finans koleksiyonlarını
-- (banks [GLOBAL kök alan] + companyData[cid].bankAccounts/kasaAccounts/
-- kasaEntries/transfers/invoices(+payments)/inflows/outflows/nonPnlOutflows/
-- kasaCategories/cells) mevcut normalize finance tablolarına yansıtır.
--
-- Blob id'leri istemci-üretimi STRING'dir ("bnk_...", "acc_...", "ksa_...",
-- "kse_...", "trf_...", "inv_...", "pay_...", "in_1"/"out_1"/"kc_..."); SERIAL
-- id ile uyuşmaz. client_id, projeksiyonun idempotent upsert + prune
-- anahtarıdır. client_id IS NULL satırlar finance CRUD'unun kendi kayıtlarıdır
-- ve projeksiyon tarafından ASLA silinmez/ezilmez (tek istisna: aynı doğal
-- anahtarla çakışan satırın "devralınması" — banks: (code),
-- categories: (company_id, section, name),
-- cells: (company_id, category_id, fiscal_year, month_idx)).
--
-- Tekillik: company_id kolonu OLAN tablolarda şirket kapsamlı
-- (company_id, client_id) — 046/047 kalıbı. company_id kolonu OLMAYAN
-- tablolarda (banks sistem-geneli; kasa_entries ve invoice_payments şirketi
-- üst FK'dan alır) düz UNIQUE(client_id). Nullable kolonda UNIQUE index birden
-- çok NULL'a izin verir → mevcut finance CRUD satırları ve akışları KIRILMAZ.
--
-- NOT: vendors.client_id 046'da eklendi — bu migration'la çakışmaz.
-- NOT: bankEntries blob alanının normalize tablo karşılığı YOK (banka hareket
--      tablosu şemada yok) — projeksiyon atlar; 044 v_bank_entries view'u sunar.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE UNIQUE INDEX IF NOT EXISTS.
-- Migration TL tarafından uygulanır — burada çalıştırılmaz.
-- ============================================================================

ALTER TABLE banks            ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE bank_accounts    ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE kasa_accounts    ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE kasa_entries     ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE transfers        ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE invoices         ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE categories       ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE cells            ADD COLUMN IF NOT EXISTS client_id TEXT;

-- Sistem-geneli / şirket kolonu olmayan tablolar: düz UNIQUE(client_id).
CREATE UNIQUE INDEX IF NOT EXISTS uq_banks_client
  ON banks(client_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_kasa_entries_client
  ON kasa_entries(client_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_payments_client
  ON invoice_payments(client_id);

-- Şirket kapsamlı tablolar: (company_id, client_id).
CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_accounts_company_client
  ON bank_accounts(company_id, client_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_kasa_accounts_company_client
  ON kasa_accounts(company_id, client_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_transfers_company_client
  ON transfers(company_id, client_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_company_client
  ON invoices(company_id, client_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_company_client
  ON categories(company_id, client_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cells_company_client
  ON cells(company_id, client_id);

COMMENT ON COLUMN banks.client_id IS
  'Blob banks[].id ("bnk_...") — GLOBAL kök alan (banks tablosu da şirketsiz). NULL = CRUD kaydı; (code) devralma istisnası vardır.';
COMMENT ON COLUMN bank_accounts.client_id IS
  'Blob bankAccounts[].id ("acc_..."). NULL = CRUD kaydı; projeksiyon dokunmaz.';
COMMENT ON COLUMN kasa_accounts.client_id IS
  'Blob kasaAccounts[].id ("ksa_..."). NULL = CRUD kaydı; projeksiyon dokunmaz.';
COMMENT ON COLUMN kasa_entries.client_id IS
  'Blob kasaEntries[].id ("kse_...", "ke_..."). NULL = CRUD kaydı; projeksiyon dokunmaz.';
COMMENT ON COLUMN transfers.client_id IS
  'Blob transfers[].id ("trf_..."). NULL = CRUD kaydı; projeksiyon dokunmaz.';
COMMENT ON COLUMN invoices.client_id IS
  'Blob invoices[].id ("inv_..."). NULL = CRUD kaydı; projeksiyon dokunmaz.';
COMMENT ON COLUMN invoice_payments.client_id IS
  'Blob invoices[].payments[].id ("pay_..."; id yoksa "<invClientId>:p<idx>"). NULL = CRUD kaydı.';
COMMENT ON COLUMN categories.client_id IS
  'Blob inflows/outflows/nonPnlOutflows/kasaCategories[].id ("in_1", "kc_..."). NULL = CRUD kaydı; (company_id, section, name) devralma istisnası vardır.';
COMMENT ON COLUMN cells.client_id IS
  'Blob cells map anahtarı "<catClientId>:<monthIdx>". NULL = CRUD kaydı; (company_id, category_id, fiscal_year, month_idx) devralma istisnası vardır.';
