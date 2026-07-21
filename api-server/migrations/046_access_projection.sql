-- ============================================================================
-- 046_access_projection.sql — Blob→SQL projeksiyon/devralma kimlik kolonları
-- ----------------------------------------------------------------------------
-- GÖREV 1 (RBAC projeksiyonu): access_custom_roles / access_role_grants /
--   access_permission_overrides tablolarına nullable client_id TEXT eklenir.
--   Blob (promet:data) RBAC koleksiyonlarının (hrCustomRoles/hrRoleGrants/
--   hrPermOverrides) id'leri istemci-üretimi STRING'dir ("role_...", "grant_...",
--   "ovr_..."); SERIAL id ile uyuşmaz. client_id, projeksiyonun idempotent
--   upsert + prune anahtarıdır. client_id IS NULL satırlar access CRUD'unun
--   kendi kayıtlarıdır ve projeksiyon tarafından ASLA silinmez/ezilmez
--   (tek istisna: aynı doğal anahtarla çakışan satırın "devralınması" —
--   roles: (company_id, name), overrides: (company_id, username, resource,
--   action) — bu durumda satır projeksiyon sahipliğine geçer).
--
-- GÖREV 2 (satınalma blob devralma): vendors / purchase_requests /
--   purchase_orders tablolarına nullable client_id TEXT eklenir; tekillik
--   şirket kapsamlıdır (company_id, client_id) — POST /v1/purchasing/adopt-blob
--   ikinci çağrıda duplicate üretmez.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE UNIQUE INDEX IF NOT EXISTS.
-- UNIQUE index nullable kolonda birden çok NULL'a izin verir → mevcut CRUD
-- satırları ve akışları KIRILMAZ.
-- Migration TL tarafından uygulanır — burada çalıştırılmaz.
-- ============================================================================


-- ============================================================================
-- GÖREV 1 — access_* client_id (blob RBAC projeksiyon anahtarı)
-- Blob id'leri ("role_<ts>_<rnd>") pratikte global tekildir → düz UNIQUE index
-- yeterli ve ON CONFLICT (client_id) arbiter'ı olarak kullanılabilir.
-- ============================================================================
ALTER TABLE access_custom_roles         ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE access_role_grants          ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE access_permission_overrides ADD COLUMN IF NOT EXISTS client_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_access_custom_roles_client_id
  ON access_custom_roles(client_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_access_role_grants_client_id
  ON access_role_grants(client_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_access_overrides_client_id
  ON access_permission_overrides(client_id);

COMMENT ON COLUMN access_custom_roles.client_id IS
  'Blob hrCustomRoles[].id ("role_..."). NULL = CRUD kaydı; projeksiyon dokunmaz.';
COMMENT ON COLUMN access_role_grants.client_id IS
  'Blob hrRoleGrants[].id ("grant_..."). NULL = CRUD kaydı; projeksiyon dokunmaz.';
COMMENT ON COLUMN access_permission_overrides.client_id IS
  'Blob hrPermOverrides[].id ("ovr_..."). NULL = CRUD kaydı; projeksiyon dokunmaz.';


-- ============================================================================
-- GÖREV 2 — satınalma client_id (blob devralma / adopt-blob anahtarı)
-- Şirket kapsamlı tekillik: (company_id, client_id).
-- ============================================================================
ALTER TABLE vendors           ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE purchase_orders   ADD COLUMN IF NOT EXISTS client_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_vendors_company_client
  ON vendors(company_id, client_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_purchase_requests_company_client
  ON purchase_requests(company_id, client_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_purchase_orders_company_client
  ON purchase_orders(company_id, client_id);

COMMENT ON COLUMN vendors.client_id IS
  'Blob accParties[].id ("party_...") — adopt-blob idempotens anahtarı. NULL = CRUD kaydı.';
COMMENT ON COLUMN purchase_requests.client_id IS
  'Blob purchaseRequests[].id ("pr_...") — adopt-blob idempotens anahtarı. NULL = CRUD kaydı.';
COMMENT ON COLUMN purchase_orders.client_id IS
  'Blob purchaseOrders[].id ("po_...") — adopt-blob idempotens anahtarı. NULL = CRUD kaydı.';
