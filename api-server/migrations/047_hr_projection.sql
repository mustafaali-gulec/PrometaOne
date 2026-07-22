-- ============================================================================
-- 047_hr_projection.sql — Blob HR çekirdeği → normalize hr tabloları projeksiyon
--                          kimlik kolonları (client_id)
-- ----------------------------------------------------------------------------
-- ÜÇÜNCÜ app-state fan-out projeksiyonu (emsal: 046_access_projection.sql).
-- PUT /v1/app-state/promet:data sonrası HrProjection + PgHrProjectionRepository
-- blob HR koleksiyonlarını (hrOrgUnits/hrDepartments/hrPositions/hrEmployees/
-- hrCandidates/hrApplications/hrLeaveRequests/hrPayrollRuns/hrAssets) mevcut
-- normalize hr tablolarına yansıtır.
--
-- Blob id'leri istemci-üretimi STRING'dir ("ou_...", "dept_...", "pos_...",
-- "emp_...", "cand_...", "app_...", "lr_...", "pr_..."); SERIAL id ile uyuşmaz.
-- client_id, projeksiyonun idempotent upsert + prune anahtarıdır.
-- client_id IS NULL satırlar hr CRUD'unun kendi kayıtlarıdır ve projeksiyon
-- tarafından ASLA silinmez/ezilmez (tek istisna: aynı doğal anahtarla çakışan
-- satırın "devralınması" — employees: (company_id, employee_no),
-- hr_payroll_runs: (company_id, period_year, period_month)).
--
-- Tekillik ŞİRKET KAPSAMLIDIR: (company_id, client_id) — tüm hedef tablolarda
-- company_id var (satınalma/046 GÖREV 2 kalıbı). Nullable kolonda UNIQUE index
-- birden çok NULL'a izin verir → mevcut hr CRUD satırları ve akışları KIRILMAZ.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE UNIQUE INDEX IF NOT EXISTS.
-- Migration TL tarafından uygulanır — burada çalıştırılmaz.
-- ============================================================================

ALTER TABLE org_units            ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE departments          ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE positions            ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE employees            ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE candidates           ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE applications         ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE hr_leave_requests    ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE hr_payroll_runs      ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE hr_payroll_items     ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE hr_assets            ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE hr_asset_assignments ADD COLUMN IF NOT EXISTS client_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_org_units_company_client
  ON org_units(company_id, client_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_departments_company_client
  ON departments(company_id, client_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_positions_company_client
  ON positions(company_id, client_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_company_client
  ON employees(company_id, client_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_candidates_company_client
  ON candidates(company_id, client_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_applications_company_client
  ON applications(company_id, client_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_leave_requests_company_client
  ON hr_leave_requests(company_id, client_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_payroll_runs_company_client
  ON hr_payroll_runs(company_id, client_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_payroll_items_company_client
  ON hr_payroll_items(company_id, client_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_assets_company_client
  ON hr_assets(company_id, client_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_asset_assignments_company_client
  ON hr_asset_assignments(company_id, client_id);

COMMENT ON COLUMN org_units.client_id IS
  'Blob hrOrgUnits[].id ("ou_..."). NULL = hr CRUD kaydı; projeksiyon dokunmaz.';
COMMENT ON COLUMN departments.client_id IS
  'Blob hrDepartments[].id ("dept_..."). NULL = hr CRUD kaydı; projeksiyon dokunmaz.';
COMMENT ON COLUMN positions.client_id IS
  'Blob hrPositions[].id ("pos_..."). NULL = hr CRUD kaydı; projeksiyon dokunmaz.';
COMMENT ON COLUMN employees.client_id IS
  'Blob hrEmployees[].id ("emp_..."). NULL = hr CRUD kaydı; (company_id, employee_no) devralma istisnası vardır.';
COMMENT ON COLUMN candidates.client_id IS
  'Blob hrCandidates[].id ("cand_..."). NULL = hr CRUD kaydı; projeksiyon dokunmaz.';
COMMENT ON COLUMN applications.client_id IS
  'Blob hrApplications[].id ("app_..."). NULL = hr CRUD kaydı; projeksiyon dokunmaz.';
COMMENT ON COLUMN hr_leave_requests.client_id IS
  'Blob hrLeaveRequests[].id ("lr_..."). NULL = hr CRUD kaydı; projeksiyon dokunmaz.';
COMMENT ON COLUMN hr_payroll_runs.client_id IS
  'Blob hrPayrollRuns[].id ("pr_..."). NULL = hr CRUD kaydı; (company_id, period_year, period_month) devralma istisnası vardır.';
COMMENT ON COLUMN hr_payroll_items.client_id IS
  'Projeksiyon bileşik anahtarı "<runClientId>:<employeeClientId>". NULL = hr CRUD kaydı.';
COMMENT ON COLUMN hr_assets.client_id IS
  'Blob hrAssets[].id. NULL = hr CRUD kaydı; projeksiyon dokunmaz.';
COMMENT ON COLUMN hr_asset_assignments.client_id IS
  'Projeksiyonun sentezlediği AÇIK zimmet satırı (asset client_id ile aynı). NULL = hr CRUD kaydı.';
