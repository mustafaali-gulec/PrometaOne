-- ============================================================================
-- 044_app_state_mirror.sql — App-state blob'unun evrensel SQL aynası
-- ----------------------------------------------------------------------------
-- PUT /v1/app-state/:key ('promet:data' + 'promet:users') sonrası sunucu
-- tarafında fan-out ile doldurulur (modules/appstate/domain/BlobProjector.ts +
-- PgMirrorRepository). Kaynak-of-truth app_state.value blob'udur; bu tablo
-- yalnız SORGULANABİLİR AYNA'dır (Report Studio). Frontend değişikliği
-- gerektirmez; blob'a eklenen YENİ alanlar otomatik olarak domain satırı olur.
--
-- TASARIM KARARLARI:
--   * company_id TEXT'tir (INT değil): blob'daki companyData anahtarları
--     istemci-üretimi string'lerdir ("comp_promet", "comp_1719912345_abc"...)
--     ve backend companies.id ile eşleşmez. '0' = global/kök alan.
--     Şirket adı için domain='companies' satırlarına join edilebilir
--     (client_id = company_id).
--   * client_id: dizi elemanının {id} alanı; id yoksa 'i'+index; dizi olmayan
--     (obje/skaler) alanlar için '_' tek satırı (skaler {value: x} sarılır).
--   * Projeksiyon, üst-düzey hassas anahtarları (password/secret/token/apiKey/
--     smtpPass...) SİLEREK yazar — bu tablo Report Studio'ya açıktır.
--
-- View'lardaki alan adları frontend/src/App.jsx'teki gerçek eleman şekillerine
-- göre doğrulanmıştır (oluşturma noktaları + veri-modeli yorumları).
-- ============================================================================

CREATE TABLE app_state_entities (
  company_id TEXT NOT NULL DEFAULT '0',   -- '0' = global/kök alan; aksi halde blob companyData anahtarı
  domain     TEXT NOT NULL,               -- blob alan adı ('hrEmployees', 'accJournalEntries', 'companies'...)
  client_id  TEXT NOT NULL,               -- eleman id'si; dizi-olmayan alanlar için '_'
  data       JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, domain, client_id)
);

CREATE INDEX idx_app_state_entities_domain ON app_state_entities (domain);
CREATE INDEX idx_app_state_entities_data_gin ON app_state_entities USING gin (data jsonb_path_ops);

-- ============================================================================
-- Rapor dostu VIEW'lar
-- NULL-güvenlik: sayısal/tarih/boolean cast'ler regex korumalı CASE ile —
-- bozuk veri sorguyu patlatmaz, NULL döner. Tarihler ISO string'in ilk 10
-- karakterinden ::date'e cast edilir (createdAt gibi timestamp'ler dahil).
-- ============================================================================

-- --- İK: Çalışanlar (blob: hrEmployees) -------------------------------------
-- Alan doğrulaması (App.jsx): firstName/lastName/status (~33899), brutSalary
-- (brüt maaş, ~33905), jobTitleId (~22044), departmentId (~23207, form ~33856),
-- startDate = işe giriş (~33574), endDate = işten çıkış (~37452, empForm.endDate).
CREATE OR REPLACE VIEW v_hr_employees AS
SELECT
  company_id,
  client_id,
  data->>'firstName'    AS first_name,
  data->>'lastName'     AS last_name,
  data->>'status'       AS status,
  data->>'departmentId' AS department_id,
  data->>'jobTitleId'   AS job_title_id,
  CASE WHEN data->>'brutSalary' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'brutSalary')::numeric END AS gross_salary,
  CASE WHEN data->>'startDate' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'startDate' FROM 1 FOR 10)::date END AS hire_date,
  CASE WHEN data->>'endDate' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'endDate' FROM 1 FOR 10)::date END AS termination_date,
  updated_at
FROM app_state_entities
WHERE domain = 'hrEmployees';

-- --- Muhasebe: Yevmiye fişleri (blob: accJournalEntries) ---------------------
-- Alan doğrulaması: voucherNo/voucherType/date/source/status/lines/totalDebit/
-- totalCredit (generateVoucherFromBankEntry ~28145 ve fiş formu ~65265).
CREATE OR REPLACE VIEW v_acc_journal_entries AS
SELECT
  company_id,
  client_id,
  data->>'voucherNo'   AS voucher_no,
  data->>'voucherType' AS voucher_type,
  CASE WHEN data->>'date' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'date' FROM 1 FOR 10)::date END AS date,
  data->>'status'      AS status,
  data->>'source'      AS source,
  CASE WHEN data->>'totalDebit' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'totalDebit')::numeric END AS total_debit,
  CASE WHEN data->>'totalCredit' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'totalCredit')::numeric END AS total_credit,
  data->>'description' AS description,
  updated_at
FROM app_state_entities
WHERE domain = 'accJournalEntries';

-- --- Muhasebe: Yevmiye satırları (accJournalEntries.lines) -------------------
-- Satır şekli: { accountCode, description, debit, credit } (~28123-28138).
CREATE OR REPLACE VIEW v_acc_journal_lines AS
SELECT
  e.company_id,
  e.client_id            AS entry_client_id,
  l.ord                  AS line_no,
  l.line->>'accountCode' AS account_code,
  l.line->>'description' AS description,
  CASE WHEN l.line->>'debit' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (l.line->>'debit')::numeric END AS debit,
  CASE WHEN l.line->>'credit' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (l.line->>'credit')::numeric END AS credit,
  e.updated_at
FROM app_state_entities e
CROSS JOIN LATERAL jsonb_array_elements(e.data->'lines') WITH ORDINALITY AS l(line, ord)
WHERE e.domain = 'accJournalEntries'
  AND jsonb_typeof(e.data->'lines') = 'array';

-- --- Finans: Faturalar (blob: invoices) --------------------------------------
-- İKİ eleman şekli var (App.jsx): elle girilen faturalar date+counterparty+type
-- kullanır (~108256), e-Faturadan içe aktarılanlar issueDate+partyName (~109771).
-- COALESCE ile ikisi de kapsanır. Ortak alanlar: invoiceNo, dueDate, partyId,
-- currency, total, netAmount, vatAmount, paidAmount, description, projectId.
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
  updated_at
FROM app_state_entities
WHERE domain = 'invoices';

-- --- Finans: Banka hareketleri (blob: bankEntries) ---------------------------
-- Alanlar (~65180): bankAccountId, date, valueDate, type(in/out), amount,
-- description, category, reference, cashflowCatId, source, createdBy.
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
  updated_at
FROM app_state_entities
WHERE domain = 'bankEntries';

-- --- Finans: Kasa hareketleri (blob: kasaEntries) ----------------------------
-- Alanlar (~93088): kasaAccountId, date, type(in/out), amount, description,
-- category, createdBy.
CREATE OR REPLACE VIEW v_kasa_entries AS
SELECT
  company_id,
  client_id,
  data->>'kasaAccountId' AS kasa_account_id,
  CASE WHEN data->>'date' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'date' FROM 1 FOR 10)::date END AS date,
  data->>'type' AS type,
  CASE WHEN data->>'amount' ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       THEN (data->>'amount')::numeric END AS amount,
  data->>'description' AS description,
  data->>'category'    AS category,
  data->>'createdBy'   AS created_by,
  updated_at
FROM app_state_entities
WHERE domain = 'kasaEntries';

-- --- Finans: Krediler (blob: loans) ------------------------------------------
-- Alanlar (~65213): type, name, contractNo, bankId, accountId, principal,
-- currency, interestRate, rateBasis, disbursementDate, termMonths, status, note.
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
  updated_at
FROM app_state_entities
WHERE domain = 'loans';

-- --- Finans: Çek/Senet (blob: checks) ----------------------------------------
-- Alanlar (CheckEditorModal ~78241): checkType, serialNo, partyId, partyName,
-- bankName, drawer(keşideci), issueDate, dueDate, amount, currency, status,
-- description.
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
  updated_at
FROM app_state_entities
WHERE domain = 'checks';

-- --- Finans: Manuel planlı ödemeler (blob: manualPayments) -------------------
-- Alanlar (ManualPlannedPaymentModal ~93755 + saveManualPayment ~65139):
-- dueDate, amount, currency, counterparty, category, description, status,
-- createdBy.
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
  updated_at
FROM app_state_entities
WHERE domain = 'manualPayments';

-- --- CRM: Fırsatlar (blob: crmDeals) -----------------------------------------
-- Veri modeli yorumu App.jsx ~78523: id, title, partyId?, leadName?,
-- leadCompany?, stage, value, currency, probability, expectedCloseDate, source,
-- ownerUsername, createdAt, wonAt, lostAt, lostReason.
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
  updated_at
FROM app_state_entities
WHERE domain = 'crmDeals';

-- --- Görevler (blob: tasks) --------------------------------------------------
-- Alanlar (~80207 + ~80340): title, description, status, priority,
-- assignerUsername, assigneeUsername, dueDate, recurrence, createdAt,
-- completedAt.
CREATE OR REPLACE VIEW v_tasks AS
SELECT
  company_id,
  client_id,
  data->>'title'    AS title,
  data->>'status'   AS status,
  data->>'priority' AS priority,
  data->>'assigneeUsername' AS assignee_username,
  data->>'assignerUsername' AS assigner_username,
  CASE WHEN data->>'dueDate' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'dueDate' FROM 1 FOR 10)::date END AS due_date,
  CASE WHEN data->>'completedAt' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'completedAt' FROM 1 FOR 10)::date END AS completed_at,
  CASE WHEN data->>'createdAt' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
       THEN substring(data->>'createdAt' FROM 1 FOR 10)::date END AS created_at,
  updated_at
FROM app_state_entities
WHERE domain = 'tasks';

-- --- Satınalma: Talepler (blob: purchaseRequests) ----------------------------
-- Veri modeli yorumu App.jsx ~78582: id, prNo, requesterUsername, departmentId,
-- status, priority, category, totalAmount, currency, requestedAt, requiredBy.
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
  updated_at
FROM app_state_entities
WHERE domain = 'purchaseRequests';

-- --- Satınalma: Siparişler (blob: purchaseOrders) ----------------------------
-- Veri modeli yorumu App.jsx ~78589: id, poNo, vendorId, sourcePRId?, status,
-- totalAmount, currency, orderedAt, expectedDelivery, deliveredAt.
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
  updated_at
FROM app_state_entities
WHERE domain = 'purchaseOrders';

-- --- Projeler (blob: projects) -----------------------------------------------
-- Alanlar (ProjectEditorModal ~89534 + saveProject ~65127): code, name,
-- customerId, status, type, budget, currency, hourlyRate, estimatedHours,
-- startDate, endDate.
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
  updated_at
FROM app_state_entities
WHERE domain = 'projects';

-- --- Kullanıcılar (ayrı anahtar: 'promet:users' → domain='users') ------------
-- Alanlar (DEFAULT_USERS ~29338): id, username, fullName, role, active.
-- password projeksiyon sırasında SİLİNİR (BlobProjector hassas anahtar
-- redaksiyonu); bu view zaten ifşa etmez.
CREATE OR REPLACE VIEW v_users AS
SELECT
  company_id,
  client_id,
  data->>'username' AS username,
  data->>'fullName' AS full_name,
  data->>'role'     AS role,
  CASE WHEN lower(data->>'active') IN ('true', 'false')
       THEN (data->>'active')::boolean END AS active,
  updated_at
FROM app_state_entities
WHERE domain = 'users';
