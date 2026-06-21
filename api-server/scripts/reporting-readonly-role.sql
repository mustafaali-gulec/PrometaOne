-- ============================================================================
-- reporting-readonly-role.sql — Report Studio (Rapor Üreteci) için salt-okunur
-- PostgreSQL rolü. Ad-hoc/kayıtlı SQL bu rolle (reportingPool) çalışır.
--
-- Çalıştırma (DB sahibi/superuser ile):
--   psql "postgres://prometa:***@HOST:5432/prometa_one" \
--        -v report_pw='GÜÇLÜ_PAROLA' -f reporting-readonly-role.sql
--   # Docker:
--   docker compose exec -T postgres \
--     psql -U prometa -d prometa_one -v report_pw='GÜÇLÜ_PAROLA' \
--     < scripts/reporting-readonly-role.sql
--
-- Bağlantı string'i → api REPORTING_DATABASE_URL:
--   postgres://prometa_report:GÜÇLÜ_PAROLA@postgres:5432/prometa_one   (container)
--   postgres://prometa_report:GÜÇLÜ_PAROLA@localhost:5432/prometa_one  (host/local)
--
-- TASARIM: FAIL-CLOSED. Yalnız ReportCatalog allowlist'indeki ilişkilere SELECT
-- verilir; gelecekteki tablolar OTOMATİK okunamaz. ReportCatalog.ts'e yeni bir
-- ilişki eklediğinde buraya da GRANT eklemeyi unutma (yoksa katalogda görünür
-- ama sorgu "permission denied" verir). users/sessions/access_*/password_resets/
-- einvoice_credentials gibi hassas tablolara KASITLI olarak erişim verilmez.
-- ============================================================================

-- 1) Salt-okunur login rolü (yoksa oluştur)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prometa_report') THEN
    EXECUTE format('CREATE ROLE prometa_report WITH LOGIN PASSWORD %L', :'report_pw');
  ELSE
    EXECUTE format('ALTER ROLE prometa_report WITH LOGIN PASSWORD %L', :'report_pw');
  END IF;
END$$;

-- 2) Bağlantı + şema kullanımı
GRANT CONNECT ON DATABASE prometa_one TO prometa_report;
GRANT USAGE   ON SCHEMA public        TO prometa_report;

-- 3) Yalnız raporlanabilir allowlist'e SELECT (ReportCatalog.ts ile birebir)
GRANT SELECT ON
  invoices, invoice_payments, banks, bank_accounts, kasa_accounts, kasa_entries,
  transfers, v_bank_balances, v_kasa_balances, v_invoice_alerts,
  companies, categories, cells, v_company_summary, finance_parties,
  employees, org_units, departments, positions,
  hr_payroll_runs, hr_payroll_items, hr_leave_requests, hr_assets,
  warehouses, materials, stock_movements, material_groups, units,
  production_orders, production_boms, production_work_centers, audit_logs
TO prometa_report;

-- 4) Rol düzeyi sertleştirme (SafeSqlExecutor zaten SET LOCAL yapıyor — ek kuşak)
ALTER ROLE prometa_report SET statement_timeout = '15s';
ALTER ROLE prometa_report SET idle_in_transaction_session_timeout = '15s';
ALTER ROLE prometa_report SET default_transaction_read_only = on;

-- ============================================================================
-- DOĞRULAMA (prometa_report ile bağlanıp dene):
--   SELECT count(*) FROM invoices;          -- ✓ çalışmalı
--   SELECT * FROM users;                     -- ✗ permission denied (beklenen)
--   UPDATE invoices SET total = 0;           -- ✗ read-only / permission denied
-- ============================================================================
