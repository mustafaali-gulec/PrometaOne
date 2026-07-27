-- ============================================================================
-- 051_fx_currency_fields.sql — Dövizli kayıtların KALICI şema karşılığı
-- ----------------------------------------------------------------------------
-- Frontend `shared/fx` çekirdeğiyle aynı sözleşme (bkz. frontend/src/shared/fx/
-- fxCore.ts). Dövizli bir kayıt şunları taşır:
--
--   currency        : tutarın girildiği para birimi (TRY/USD/EUR)
--   <amount>        : ORİJİNAL para birimindeki tutar (mevcut kolonlar)
--   fx_rate         : 1 birim döviz kaç TRY — KAYIT ANINDA DONDURULUR
--   fx_rate_source  : 'manual' | 'tcmb' — kur nereden geldi
--   fx_rate_date    : kurun ait olduğu gün
--   <amount>_try    : kurdan türetilen TRY karşılığı (raporların topladığı kolon)
--
-- NEDEN _try KOLONU: kur sonradan değişince geçmiş tutarlar KAYMAMALI (VUK/
-- e-Defter). Raporlar TRY toplamı için bu kolonu okur; canlı çevrim yapmaz.
--
-- fx_rate NULL  → kayıt TRY'dir ya da kuru bilinmiyor; TRY karşılığı için
--                 exchange_rate_history (006) üzerinden tarihli kur kullanılır.
--
-- Bu migration İKİ tarafı kapsar:
--   (A) Normalize tablolar  — gerçek kolonlar (finance, purchasing, warehouse)
--   (B) app_state_entities  — blob'da yaşayan kayıtlar (banka hareketi, çek,
--       kredi, manuel ödeme, CRM fırsatı, PR/PO) için 044 mirror view'larına
--       fx alanları eklenir → Report Studio bu alanları sorgulayabilir.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE VIEW.
-- Migration TL tarafından uygulanır — burada çalıştırılmaz.
-- ============================================================================

-- Kur kaynağı: sadece iki geçerli değer (NULL = dövizsiz/bilinmiyor).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fx_rate_source') THEN
    CREATE TYPE fx_rate_source AS ENUM ('manual', 'tcmb');
  END IF;
END $$;

-- ============================================================================
-- (A) NORMALİZE TABLOLAR
-- ============================================================================

-- --- Finans: kasa hareketleri -----------------------------------------------
-- currency kolonu YOKTU (kasa hesabından türetiliyordu). Dövizli hareket TL
-- kasada da girilebildiği için harekete kendi para birimi eklenir.
ALTER TABLE kasa_entries ADD COLUMN IF NOT EXISTS currency       currency_code NOT NULL DEFAULT 'TRY';
ALTER TABLE kasa_entries ADD COLUMN IF NOT EXISTS fx_rate        NUMERIC(20, 6);
ALTER TABLE kasa_entries ADD COLUMN IF NOT EXISTS fx_rate_source fx_rate_source;
ALTER TABLE kasa_entries ADD COLUMN IF NOT EXISTS fx_rate_date   DATE;
ALTER TABLE kasa_entries ADD COLUMN IF NOT EXISTS amount_try     NUMERIC(20, 2);

-- --- Finans: faturalar ------------------------------------------------------
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS fx_rate        NUMERIC(20, 6);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS fx_rate_source fx_rate_source;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS fx_rate_date   DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_try      NUMERIC(20, 2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal_try   NUMERIC(20, 2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS kdv_try        NUMERIC(20, 2);

-- --- Finans: fatura ödemeleri -----------------------------------------------
ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS fx_rate        NUMERIC(20, 6);
ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS fx_rate_source fx_rate_source;
ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS fx_rate_date   DATE;
ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS amount_try     NUMERIC(20, 2);

-- --- Finans: transferler ----------------------------------------------------
-- İki bacak iki farklı para biriminde olabilir → iki ayrı kur/TRY karşılığı.
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS from_fx_rate    NUMERIC(20, 6);
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS to_fx_rate      NUMERIC(20, 6);
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS fx_rate_source  fx_rate_source;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS fx_rate_date    DATE;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS from_amount_try NUMERIC(20, 2);
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS to_amount_try   NUMERIC(20, 2);

-- --- Satınalma: talep (PR) --------------------------------------------------
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS fx_rate          NUMERIC(20, 6);
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS fx_rate_source   fx_rate_source;
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS fx_rate_date     DATE;
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS total_amount_try NUMERIC(20, 2);

-- --- Satınalma: sipariş (PO) ------------------------------------------------
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS fx_rate          NUMERIC(20, 6);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS fx_rate_source   fx_rate_source;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS fx_rate_date     DATE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS total_amount_try NUMERIC(20, 2);

-- --- Depo/Stok: stok hareketleri --------------------------------------------
-- İthal alım / dövizli tedarik: birim fiyat dövizle girilir, maliyet TL'ye
-- kurdan çevrilir. unit_cost_base DAİMA TL bazlıdır (değerleme para birimi).
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS currency       currency_code NOT NULL DEFAULT 'TRY';
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS fx_rate        NUMERIC(20, 6);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS fx_rate_source fx_rate_source;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS fx_rate_date   DATE;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS total_try      NUMERIC(20, 4);

-- --- Depo/Stok: malzeme kartı fiyatları -------------------------------------
-- purchase_price / sale_price hangi para biriminde tanımlı (038).
ALTER TABLE materials ADD COLUMN IF NOT EXISTS price_currency currency_code NOT NULL DEFAULT 'TRY';

-- --- Geriye dönük doldurma ---------------------------------------------------
-- Mevcut TRY satırlarında TRY karşılığı = tutarın kendisi (kur 1).
UPDATE kasa_entries      SET amount_try       = amount        WHERE amount_try IS NULL AND currency = 'TRY';
UPDATE invoices          SET total_try        = total,
                             subtotal_try     = subtotal,
                             kdv_try          = kdv           WHERE total_try IS NULL AND currency = 'TRY';
UPDATE invoice_payments  SET amount_try       = amount        WHERE amount_try IS NULL AND currency = 'TRY';
UPDATE transfers         SET from_amount_try  = from_amount   WHERE from_amount_try IS NULL AND from_currency = 'TRY';
UPDATE transfers         SET to_amount_try    = to_amount     WHERE to_amount_try IS NULL AND to_currency = 'TRY';
UPDATE purchase_requests SET total_amount_try = total_amount  WHERE total_amount_try IS NULL AND currency = 'TRY';
UPDATE purchase_orders   SET total_amount_try = total_amount  WHERE total_amount_try IS NULL AND currency = 'TRY';
UPDATE stock_movements   SET total_try        = total         WHERE total_try IS NULL AND currency = 'TRY';

-- --- Raporlama indeksleri ---------------------------------------------------
-- Dövizli kayıtları hızlı süzmek için (TRY satırlar indekse girmez).
CREATE INDEX IF NOT EXISTS idx_kasa_entries_fx      ON kasa_entries(currency)      WHERE currency <> 'TRY';
CREATE INDEX IF NOT EXISTS idx_invoices_fx          ON invoices(company_id, currency) WHERE currency <> 'TRY';
CREATE INDEX IF NOT EXISTS idx_purchase_orders_fx   ON purchase_orders(company_id, currency) WHERE currency <> 'TRY';
CREATE INDEX IF NOT EXISTS idx_purchase_requests_fx ON purchase_requests(company_id, currency) WHERE currency <> 'TRY';
CREATE INDEX IF NOT EXISTS idx_stock_movements_fx   ON stock_movements(company_id, currency) WHERE currency <> 'TRY';

-- ============================================================================
-- (B) BLOB MIRROR VIEW'LARI (044) — fx alanları eklenir
-- ----------------------------------------------------------------------------
-- Banka hareketi, çek/senet, kredi, manuel ödeme, CRM fırsatı ve blob PR/PO
-- normalize tabloya sahip değildir; app_state_entities JSONB'sinde yaşarlar.
-- View'lara fx kolonları eklemek bu kayıtları da Report Studio'da dövizli
-- sorgulanabilir yapar. Kolon SIRASI korunur, yeni kolonlar sona eklenir.
-- ============================================================================

-- Ortak fx ayıklama kalıbı (view'lar içinde inline):
--   fx_rate        : sayısal, pozitif
--   fx_rate_source : 'manual' | 'tcmb'
--   fx_rate_date   : ISO gün
--   *_try          : blob'da dondurulmuş TRY karşılığı
--
-- ÖNEMLİ: CREATE OR REPLACE VIEW mevcut kolonların AD/TİP/SIRA'sını değiştiremez.
-- Bu yüzden 044'teki tanımlar BİREBİR korunur, fx kolonları SONA eklenir.

-- --- Banka hareketleri (044'te currency kolonu YOKTU — sona eklenir) ---------
CREATE OR REPLACE VIEW v_bank_entries AS
SELECT
  company_id,
  client_id,
  data->>'bankAccountId' AS bank_account_id,
  CASE WHEN data->>'date' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'date' FROM 1 FOR 10)::date END AS date,
  CASE WHEN data->>'valueDate' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'valueDate' FROM 1 FOR 10)::date END AS value_date,
  data->>'type' AS type,
  CASE WHEN data->>'amount' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'amount')::numeric END AS amount,
  data->>'description'   AS description,
  data->>'category'      AS category,
  data->>'reference'     AS reference,
  data->>'cashflowCatId' AS cashflow_cat_id,
  data->>'source'        AS source,
  data->>'createdBy'     AS created_by,
  updated_at,
  COALESCE(data->>'currency', 'TRY') AS currency,
  CASE WHEN data->>'fxRate' ~ '^[0-9]+(\.[0-9]+)?$' THEN (data->>'fxRate')::numeric END AS fx_rate,
  data->>'fxRateSource' AS fx_rate_source,
  CASE WHEN data->>'fxRateDate' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'fxRateDate' FROM 1 FOR 10)::date END AS fx_rate_date,
  CASE WHEN data->>'amountTRY' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'amountTRY')::numeric END AS amount_try
FROM app_state_entities
WHERE domain = 'bankEntries';

-- --- Blob faturalar ----------------------------------------------------------
CREATE OR REPLACE VIEW v_blob_invoices AS
SELECT
  company_id,
  client_id,
  data->>'invoiceNo' AS invoice_no,
  data->>'type'      AS type,
  CASE WHEN COALESCE(data->>'date', data->>'issueDate') ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(COALESCE(data->>'date', data->>'issueDate') FROM 1 FOR 10)::date END AS date,
  CASE WHEN data->>'dueDate' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'dueDate' FROM 1 FOR 10)::date END AS due_date,
  COALESCE(data->>'counterparty', data->>'partyName') AS counterparty,
  data->>'partyId'  AS party_id,
  data->>'currency' AS currency,
  CASE WHEN data->>'total' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'total')::numeric END AS total,
  CASE WHEN data->>'netAmount' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'netAmount')::numeric END AS net_amount,
  CASE WHEN data->>'vatAmount' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'vatAmount')::numeric END AS vat_amount,
  CASE WHEN data->>'paidAmount' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'paidAmount')::numeric END AS paid_amount,
  data->>'description' AS description,
  data->>'projectId'   AS project_id,
  data->>'source'      AS source,
  updated_at,
  CASE WHEN data->>'fxRate' ~ '^[0-9]+(\.[0-9]+)?$' THEN (data->>'fxRate')::numeric END AS fx_rate,
  data->>'fxRateSource' AS fx_rate_source,
  CASE WHEN data->>'fxRateDate' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'fxRateDate' FROM 1 FOR 10)::date END AS fx_rate_date,
  CASE WHEN data->>'totalTRY' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'totalTRY')::numeric END AS total_try,
  CASE WHEN data->>'netAmountTRY' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'netAmountTRY')::numeric END AS net_amount_try,
  CASE WHEN data->>'vatAmountTRY' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'vatAmountTRY')::numeric END AS vat_amount_try
FROM app_state_entities
WHERE domain = 'invoices';

-- --- Krediler ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_loans AS
SELECT
  company_id,
  client_id,
  data->>'name'       AS name,
  data->>'type'       AS type,
  data->>'contractNo' AS contract_no,
  data->>'bankId'     AS bank_id,
  data->>'accountId'  AS account_id,
  CASE WHEN data->>'principal' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'principal')::numeric END AS principal,
  data->>'currency' AS currency,
  CASE WHEN data->>'interestRate' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'interestRate')::numeric END AS interest_rate,
  data->>'rateBasis' AS rate_basis,
  CASE WHEN data->>'disbursementDate' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'disbursementDate' FROM 1 FOR 10)::date END AS disbursement_date,
  CASE WHEN data->>'termMonths' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'termMonths')::numeric END AS term_months,
  data->>'status' AS status,
  data->>'note'   AS note,
  updated_at,
  CASE WHEN data->>'fxRate' ~ '^[0-9]+(\.[0-9]+)?$' THEN (data->>'fxRate')::numeric END AS fx_rate,
  data->>'fxRateSource' AS fx_rate_source,
  CASE WHEN data->>'fxRateDate' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'fxRateDate' FROM 1 FOR 10)::date END AS fx_rate_date,
  CASE WHEN data->>'principalTRY' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'principalTRY')::numeric END AS principal_try
FROM app_state_entities
WHERE domain = 'loans';

-- --- Çek/Senet ---------------------------------------------------------------
CREATE OR REPLACE VIEW v_checks AS
SELECT
  company_id,
  client_id,
  data->>'checkType' AS check_type,
  data->>'serialNo'  AS serial_no,
  data->>'partyId'   AS party_id,
  data->>'partyName' AS party_name,
  data->>'bankName'  AS bank_name,
  data->>'drawer'    AS drawer,
  CASE WHEN data->>'issueDate' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'issueDate' FROM 1 FOR 10)::date END AS issue_date,
  CASE WHEN data->>'dueDate' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'dueDate' FROM 1 FOR 10)::date END AS due_date,
  CASE WHEN data->>'amount' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'amount')::numeric END AS amount,
  data->>'currency'    AS currency,
  data->>'status'      AS status,
  data->>'description' AS description,
  updated_at,
  CASE WHEN data->>'fxRate' ~ '^[0-9]+(\.[0-9]+)?$' THEN (data->>'fxRate')::numeric END AS fx_rate,
  data->>'fxRateSource' AS fx_rate_source,
  CASE WHEN data->>'fxRateDate' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'fxRateDate' FROM 1 FOR 10)::date END AS fx_rate_date,
  CASE WHEN data->>'amountTRY' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'amountTRY')::numeric END AS amount_try
FROM app_state_entities
WHERE domain = 'checks';

-- --- Manuel planlı ödemeler --------------------------------------------------
CREATE OR REPLACE VIEW v_manual_payments AS
SELECT
  company_id,
  client_id,
  data->>'counterparty' AS counterparty,
  CASE WHEN data->>'amount' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'amount')::numeric END AS amount,
  data->>'currency' AS currency,
  CASE WHEN data->>'dueDate' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'dueDate' FROM 1 FOR 10)::date END AS due_date,
  data->>'category'    AS category,
  data->>'description' AS description,
  data->>'status'      AS status,
  data->>'createdBy'   AS created_by,
  updated_at,
  CASE WHEN data->>'fxRate' ~ '^[0-9]+(\.[0-9]+)?$' THEN (data->>'fxRate')::numeric END AS fx_rate,
  data->>'fxRateSource' AS fx_rate_source,
  CASE WHEN data->>'fxRateDate' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'fxRateDate' FROM 1 FOR 10)::date END AS fx_rate_date,
  CASE WHEN data->>'amountTRY' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'amountTRY')::numeric END AS amount_try
FROM app_state_entities
WHERE domain = 'manualPayments';

-- --- CRM fırsatları ----------------------------------------------------------
CREATE OR REPLACE VIEW v_crm_deals AS
SELECT
  company_id,
  client_id,
  data->>'title' AS title,
  data->>'stage' AS stage,
  CASE WHEN data->>'value' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'value')::numeric END AS value,
  data->>'currency' AS currency,
  CASE WHEN data->>'probability' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'probability')::numeric END AS probability,
  data->>'partyId'     AS party_id,
  data->>'leadName'    AS lead_name,
  data->>'leadCompany' AS lead_company,
  CASE WHEN data->>'expectedCloseDate' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'expectedCloseDate' FROM 1 FOR 10)::date END AS expected_close_date,
  data->>'source'        AS source,
  data->>'ownerUsername' AS owner_username,
  CASE WHEN data->>'createdAt' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'createdAt' FROM 1 FOR 10)::date END AS created_at,
  updated_at,
  CASE WHEN data->>'fxRate' ~ '^[0-9]+(\.[0-9]+)?$' THEN (data->>'fxRate')::numeric END AS fx_rate,
  data->>'fxRateSource' AS fx_rate_source,
  CASE WHEN data->>'fxRateDate' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'fxRateDate' FROM 1 FOR 10)::date END AS fx_rate_date,
  CASE WHEN data->>'valueTRY' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'valueTRY')::numeric END AS value_try
FROM app_state_entities
WHERE domain = 'crmDeals';

-- --- Blob satınalma talepleri ------------------------------------------------
CREATE OR REPLACE VIEW v_purchase_requests AS
SELECT
  company_id,
  client_id,
  data->>'prNo'     AS pr_no,
  data->>'status'   AS status,
  data->>'priority' AS priority,
  data->>'category' AS category,
  CASE WHEN data->>'totalAmount' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'totalAmount')::numeric END AS total_amount,
  data->>'currency'          AS currency,
  data->>'requesterUsername' AS requester_username,
  data->>'departmentId'      AS department_id,
  CASE WHEN data->>'requestedAt' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'requestedAt' FROM 1 FOR 10)::date END AS requested_at,
  CASE WHEN data->>'requiredBy' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'requiredBy' FROM 1 FOR 10)::date END AS required_by,
  updated_at,
  CASE WHEN data->>'fxRate' ~ '^[0-9]+(\.[0-9]+)?$' THEN (data->>'fxRate')::numeric END AS fx_rate,
  data->>'fxRateSource' AS fx_rate_source,
  CASE WHEN data->>'fxRateDate' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'fxRateDate' FROM 1 FOR 10)::date END AS fx_rate_date,
  CASE WHEN data->>'totalAmountTRY' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'totalAmountTRY')::numeric END AS total_amount_try
FROM app_state_entities
WHERE domain = 'purchaseRequests';

-- --- Blob satınalma siparişleri ----------------------------------------------
CREATE OR REPLACE VIEW v_purchase_orders AS
SELECT
  company_id,
  client_id,
  data->>'poNo'       AS po_no,
  data->>'vendorId'   AS vendor_id,
  data->>'sourcePRId' AS source_pr_id,
  data->>'status'     AS status,
  CASE WHEN data->>'totalAmount' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'totalAmount')::numeric END AS total_amount,
  data->>'currency' AS currency,
  CASE WHEN data->>'orderedAt' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'orderedAt' FROM 1 FOR 10)::date END AS ordered_at,
  CASE WHEN data->>'expectedDelivery' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'expectedDelivery' FROM 1 FOR 10)::date END AS expected_delivery,
  CASE WHEN data->>'deliveredAt' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'deliveredAt' FROM 1 FOR 10)::date END AS delivered_at,
  updated_at,
  CASE WHEN data->>'fxRate' ~ '^[0-9]+(\.[0-9]+)?$' THEN (data->>'fxRate')::numeric END AS fx_rate,
  data->>'fxRateSource' AS fx_rate_source,
  CASE WHEN data->>'fxRateDate' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'fxRateDate' FROM 1 FOR 10)::date END AS fx_rate_date,
  CASE WHEN data->>'totalAmountTRY' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'totalAmountTRY')::numeric END AS total_amount_try
FROM app_state_entities
WHERE domain = 'purchaseOrders';

-- --- Projeler (bütçe dövizi) -------------------------------------------------
CREATE OR REPLACE VIEW v_projects AS
SELECT
  company_id,
  client_id,
  data->>'code'       AS code,
  data->>'name'       AS name,
  data->>'customerId' AS customer_id,
  data->>'status'     AS status,
  data->>'type'       AS type,
  CASE WHEN data->>'budget' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'budget')::numeric END AS budget,
  data->>'currency' AS currency,
  CASE WHEN data->>'startDate' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'startDate' FROM 1 FOR 10)::date END AS start_date,
  CASE WHEN data->>'endDate' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'endDate' FROM 1 FOR 10)::date END AS end_date,
  updated_at,
  CASE WHEN data->>'fxRate' ~ '^[0-9]+(\.[0-9]+)?$' THEN (data->>'fxRate')::numeric END AS fx_rate,
  data->>'fxRateSource' AS fx_rate_source,
  CASE WHEN data->>'fxRateDate' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'fxRateDate' FROM 1 FOR 10)::date END AS fx_rate_date,
  CASE WHEN data->>'budgetTRY' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'budgetTRY')::numeric END AS budget_try
FROM app_state_entities
WHERE domain = 'projects';
