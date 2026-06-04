-- ============================================================================
-- 021_access_rbac.sql — RBAC / Özel Roller (Faz B-4)
-- ----------------------------------------------------------------------------
-- modules/access/ özel rol + grant + override persistence katmanı.
--
-- Tablolar:
--   access_custom_roles         → şirkete özel rol tanımları (permissions TEXT[])
--   access_role_grants          → rolü bir özneye (user/employee/...) atama
--   access_permission_overrides → kullanıcı bazlı tekil allow/deny override
--
-- companies (002) yeniden kullanılır.
-- Idempotent: enum'lar guard'lı, tablo/index/trigger IF NOT EXISTS.
-- Migration TL tarafından docker image içinde uygulanır — burada çalıştırılmaz.
-- ============================================================================


-- ============================================================================
-- ENUM — access_subject_type (grant öznesinin türü)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'access_subject_type') THEN
    CREATE TYPE access_subject_type AS ENUM (
      'user', 'employee', 'job_title', 'department', 'org_unit'
    );
  END IF;
END
$$;


-- ============================================================================
-- ACCESS_CUSTOM_ROLES — şirkete özel rol tanımları.
-- permissions: 'resource.action' string'lerinden oluşan dizi (örn 'hr.employees.view').
-- ============================================================================
CREATE TABLE IF NOT EXISTS access_custom_roles (
  id           SERIAL PRIMARY KEY,
  company_id   INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  permissions  TEXT[] NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_access_custom_roles_company_name UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_access_custom_roles_company
  ON access_custom_roles(company_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'access_custom_roles_updated_at'
  ) THEN
    CREATE TRIGGER access_custom_roles_updated_at BEFORE UPDATE ON access_custom_roles
      FOR EACH ROW EXECUTE FUNCTION trg_updated_at();
  END IF;
END
$$;


-- ============================================================================
-- ACCESS_ROLE_GRANTS — bir özel rolü bir özneye atar.
-- subject_id: 'user' için username; diğer türler için numeric id'nin text hali.
-- cascade: department/org_unit grant'ları alt birimlere de yayılır mı?
-- valid_from / valid_until: opsiyonel geçerlilik penceresi.
-- ============================================================================
CREATE TABLE IF NOT EXISTS access_role_grants (
  id           SERIAL PRIMARY KEY,
  company_id   INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role_id      INT NOT NULL REFERENCES access_custom_roles(id) ON DELETE CASCADE,
  subject_type access_subject_type NOT NULL,
  subject_id   TEXT NOT NULL,
  cascade      BOOLEAN NOT NULL DEFAULT TRUE,
  valid_from   TIMESTAMPTZ,
  valid_until  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_role_grants_company
  ON access_role_grants(company_id);
CREATE INDEX IF NOT EXISTS idx_access_role_grants_company_role
  ON access_role_grants(company_id, role_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'access_role_grants_updated_at'
  ) THEN
    CREATE TRIGGER access_role_grants_updated_at BEFORE UPDATE ON access_role_grants
      FOR EACH ROW EXECUTE FUNCTION trg_updated_at();
  END IF;
END
$$;


-- ============================================================================
-- ACCESS_PERMISSION_OVERRIDES — kullanıcı bazlı tekil allow/deny.
-- deny (allow=false) her zaman grant'tan önceliklidir.
-- expires_at: opsiyonel geçerlilik bitişi.
-- ============================================================================
CREATE TABLE IF NOT EXISTS access_permission_overrides (
  id          SERIAL PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  username    TEXT NOT NULL,
  resource    TEXT NOT NULL,
  action      TEXT NOT NULL,
  allow       BOOLEAN NOT NULL,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_access_overrides_company_user_perm
    UNIQUE (company_id, username, resource, action)
);

CREATE INDEX IF NOT EXISTS idx_access_overrides_company_username
  ON access_permission_overrides(company_id, username);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'access_permission_overrides_updated_at'
  ) THEN
    CREATE TRIGGER access_permission_overrides_updated_at BEFORE UPDATE ON access_permission_overrides
      FOR EACH ROW EXECUTE FUNCTION trg_updated_at();
  END IF;
END
$$;


-- ============================================================================
-- Yorumlar (dökümantasyon)
-- ============================================================================
COMMENT ON TABLE access_custom_roles IS
  'Faz B-4: şirkete özel rol tanımları (permissions TEXT[] = resource.action).';
COMMENT ON TABLE access_role_grants IS
  'Faz B-4: özel rolü bir özneye (user/employee/job_title/department/org_unit) atar.';
COMMENT ON TABLE access_permission_overrides IS
  'Faz B-4: kullanıcı bazlı tekil allow/deny override (deny grant''tan önceliklidir).';
