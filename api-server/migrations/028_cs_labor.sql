-- ============================================================================
-- 028_cs_labor.sql
-- Prometa One — Şantiye Yönetim (Construction) Faz SF-6: İş Gücü & Makine Parkı.
--
-- E6 bileşeni: Saha personeli (HR çalışanı veya taşeron işçi), günlük puantaj,
-- makine parkı ve makine logları (çalışma saati/yakıt/bakım). Maliyet projeye /
-- iş kalemine (boq_line_id) dağıtılabilir.
-- ============================================================================

CREATE TYPE cs_machine_kind AS ENUM ('owned', 'rented', 'subcontractor');

-- ============================================================================
-- PERSONNEL — Saha personeli. employee_id: HR çalışanı (gevşek bağ, FK yok);
-- vendor_id: taşeron firma. is_subcontractor true ise taşeron işçi.
-- ============================================================================
CREATE TABLE cs_personnel (
  id               BIGSERIAL PRIMARY KEY,
  company_id       INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id       BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  employee_id      BIGINT,                              -- HR employees (gevşek bağ)
  vendor_id        BIGINT REFERENCES vendors(id) ON DELETE SET NULL,
  full_name        VARCHAR(200) NOT NULL,
  trade            VARCHAR(80),                          -- meslek (duvarcı, demirci …)
  daily_cost       NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (daily_cost >= 0),
  is_subcontractor BOOLEAN NOT NULL DEFAULT FALSE,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_by       INT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cs_personnel_project ON cs_personnel(project_id);
CREATE TRIGGER cs_personnel_updated_at BEFORE UPDATE ON cs_personnel
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ============================================================================
-- TIMESHEETS — Günlük puantaj. status_code: P=tam, Y=yarım, X=yok, I=izin.
-- ============================================================================
CREATE TABLE cs_timesheets (
  id            BIGSERIAL PRIMARY KEY,
  company_id    INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  personnel_id  BIGINT NOT NULL REFERENCES cs_personnel(id) ON DELETE CASCADE,
  work_date     DATE NOT NULL,
  hours         NUMERIC(6, 2) NOT NULL DEFAULT 0 CHECK (hours >= 0),
  overtime      NUMERIC(6, 2) NOT NULL DEFAULT 0 CHECK (overtime >= 0),
  status_code   VARCHAR(10) NOT NULL DEFAULT 'P',
  boq_line_id   BIGINT REFERENCES cs_boq_lines(id) ON DELETE SET NULL,
  created_by    INT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (personnel_id, work_date)
);

CREATE INDEX idx_cs_ts_date ON cs_timesheets(company_id, work_date);
CREATE TRIGGER cs_timesheets_updated_at BEFORE UPDATE ON cs_timesheets
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ============================================================================
-- MACHINES — Makine parkı (firma geneli). kind: owned|rented|subcontractor.
-- ============================================================================
CREATE TABLE cs_machines (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code        VARCHAR(40)  NOT NULL,
  name        VARCHAR(200) NOT NULL,
  kind        cs_machine_kind NOT NULL DEFAULT 'owned',
  vendor_id   BIGINT REFERENCES vendors(id) ON DELETE SET NULL,
  hourly_cost NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (hourly_cost >= 0),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  INT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, code)
);

CREATE INDEX idx_cs_machines_company_active ON cs_machines(company_id, active);
CREATE TRIGGER cs_machines_updated_at BEFORE UPDATE ON cs_machines
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ============================================================================
-- MACHINE LOGS — Makine günlük çalışma/yakıt/bakım kaydı.
-- ============================================================================
CREATE TABLE cs_machine_logs (
  id            BIGSERIAL PRIMARY KEY,
  company_id    INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  machine_id    BIGINT NOT NULL REFERENCES cs_machines(id) ON DELETE CASCADE,
  project_id    BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  log_date      DATE NOT NULL,
  work_hours    NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (work_hours >= 0),
  fuel_liters   NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (fuel_liters >= 0),
  fuel_cost     NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (fuel_cost >= 0),
  maint_cost    NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (maint_cost >= 0),
  boq_line_id   BIGINT REFERENCES cs_boq_lines(id) ON DELETE SET NULL,
  note          VARCHAR(500),
  created_by    INT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cs_mlog_project ON cs_machine_logs(project_id, log_date);
CREATE INDEX idx_cs_mlog_machine ON cs_machine_logs(machine_id);
