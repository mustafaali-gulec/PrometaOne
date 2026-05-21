-- ============================================================================
-- 012_hr.sql — HR Core (Faz 4)
-- ----------------------------------------------------------------------------
-- modules/hr/ TS modülünün persistence katmanı.
--
-- Tablolar:
--   org_units                  → recursive ağaç (Company → bölüm/birim hiyerarşisi)
--   departments                → org_unit'a bağlı departman
--   positions                  → departmana bağlı pozisyon kütüphanesi
--   employees                  → çalışan sicili (User'a opsiyonel link)
--   candidates                 → işe alım aday havuzu
--   applications               → bir Candidate'in bir Position'a başvurusu
--   application_stage_history  → başvuru stage geçişlerinin audit trail'i
--
-- Karar: docs/adr/0005-hr-manager-role-and-employee-user-link.md
-- Plan : docs/MIGRATION_ROADMAP.md § Faz 4 — HR Core (DETAYLI PLAN)
--
-- companies tablosu (002_companies.sql) yeniden kullanılır — burada
-- tekrar oluşturulmaz.
-- ============================================================================


-- ============================================================================
-- ORG_UNITS — recursive ağaç (örn. Genel Müdürlük → Bölge → Şube)
-- ============================================================================
CREATE TABLE org_units (
  id           SERIAL PRIMARY KEY,
  company_id   INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  parent_id    INT REFERENCES org_units(id) ON DELETE RESTRICT,  -- ağacı koru
  name         VARCHAR(200) NOT NULL,
  code         VARCHAR(40),                                       -- şirket içi kısa kod
  sort_order   INT NOT NULL DEFAULT 0,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT org_units_name_not_empty CHECK (length(trim(name)) > 0),
  CONSTRAINT org_units_no_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE INDEX idx_org_units_company_parent ON org_units(company_id, parent_id);
CREATE INDEX idx_org_units_active ON org_units(company_id) WHERE active = TRUE;
CREATE UNIQUE INDEX uq_org_units_company_code
  ON org_units(company_id, code) WHERE code IS NOT NULL;

CREATE TRIGGER org_units_updated_at BEFORE UPDATE ON org_units
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();


-- Ağaç cycle önleyici trigger.
-- parent_id atanırken/değiştirilirken yeni parent'a giderken bu kayda
-- ulaşılabiliyor mu? Ulaşılıyorsa cycle — reddet.
CREATE OR REPLACE FUNCTION trg_org_units_no_cycle()
RETURNS TRIGGER AS $$
DECLARE
  ancestor_id INT := NEW.parent_id;
  hop_count   INT := 0;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Aynı şirket içinde olmalı
  IF NOT EXISTS (
    SELECT 1 FROM org_units
    WHERE id = NEW.parent_id AND company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'org_units.parent_id farkli company_id''ye ait (id=%)', NEW.parent_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Yukarı yürü, kendine geri dönüyor mu kontrol et
  WHILE ancestor_id IS NOT NULL LOOP
    IF ancestor_id = NEW.id THEN
      RAISE EXCEPTION 'org_units cycle algilandi: id=% parent_id=%', NEW.id, NEW.parent_id
        USING ERRCODE = 'check_violation';
    END IF;
    hop_count := hop_count + 1;
    IF hop_count > 64 THEN
      RAISE EXCEPTION 'org_units hiyerarsisi 64 seviyeyi astı — muhtemel cycle' USING ERRCODE = 'check_violation';
    END IF;
    SELECT parent_id INTO ancestor_id FROM org_units WHERE id = ancestor_id;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER org_units_no_cycle
  BEFORE INSERT OR UPDATE OF parent_id, company_id ON org_units
  FOR EACH ROW EXECUTE FUNCTION trg_org_units_no_cycle();


-- ============================================================================
-- DEPARTMENTS — bir org_unit'a (veya direkt company'ye) bağlı
-- manager_employee_id geç doldurulur (employees henüz yok aşağıda tanımlanacak).
-- DEFERRABLE FK ile chicken-egg çözülür.
-- ============================================================================
CREATE TABLE departments (
  id                   SERIAL PRIMARY KEY,
  company_id           INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  org_unit_id          INT REFERENCES org_units(id) ON DELETE SET NULL,
  name                 VARCHAR(200) NOT NULL,
  code                 VARCHAR(40),
  manager_employee_id  INT,                       -- FK aşağıda employees tanımlanınca eklenir
  active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT departments_name_not_empty CHECK (length(trim(name)) > 0)
);

CREATE INDEX idx_departments_company_org_unit
  ON departments(company_id, org_unit_id);
CREATE INDEX idx_departments_active
  ON departments(company_id) WHERE active = TRUE;
CREATE UNIQUE INDEX uq_departments_company_code
  ON departments(company_id, code) WHERE code IS NOT NULL;

CREATE TRIGGER departments_updated_at BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();


-- ============================================================================
-- POSITIONS — iş tanımları / job title kütüphanesi
-- ============================================================================
CREATE TYPE position_status AS ENUM ('draft', 'open', 'closed');

CREATE TABLE positions (
  id                SERIAL PRIMARY KEY,
  company_id        INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  department_id     INT REFERENCES departments(id) ON DELETE SET NULL,
  title             VARCHAR(200) NOT NULL,
  description       TEXT,
  status            position_status NOT NULL DEFAULT 'draft',
  headcount_target  INT NOT NULL DEFAULT 1,
  min_salary        NUMERIC(20, 2),
  max_salary        NUMERIC(20, 2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT positions_title_not_empty CHECK (length(trim(title)) > 0),
  CONSTRAINT positions_headcount_nonneg CHECK (headcount_target >= 0),
  CONSTRAINT positions_salary_order
    CHECK (min_salary IS NULL OR max_salary IS NULL OR min_salary <= max_salary)
);

CREATE INDEX idx_positions_company_status
  ON positions(company_id, status);
CREATE INDEX idx_positions_department
  ON positions(department_id);

CREATE TRIGGER positions_updated_at BEFORE UPDATE ON positions
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();


-- ============================================================================
-- EMPLOYEES — çalışan sicili.
-- user_id NULL olabilir (mavi yaka, taşeron, sistem hesabı yok).
-- ADR-0005: 1:1 opsiyonel link.
-- ============================================================================
CREATE TYPE employee_status AS ENUM ('probation', 'active', 'on_leave', 'terminated');
CREATE TYPE employment_type AS ENUM ('full_time', 'part_time', 'contract', 'intern');

CREATE TABLE employees (
  id                       SERIAL PRIMARY KEY,
  company_id               INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id                  INT REFERENCES users(id) ON DELETE SET NULL,  -- opsiyonel link
  department_id            INT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  position_id              INT REFERENCES positions(id) ON DELETE SET NULL,
  employee_no              VARCHAR(40) NOT NULL,                          -- şirket içi numara
  first_name               VARCHAR(100) NOT NULL,
  last_name                VARCHAR(100) NOT NULL,
  tc_kimlik                VARCHAR(11),                                   -- TR vatandaş için
  email                    CITEXT,
  phone                    VARCHAR(32),
  hire_date                DATE NOT NULL,
  termination_date         DATE,
  status                   employee_status NOT NULL DEFAULT 'probation',
  employment_type          employment_type NOT NULL DEFAULT 'full_time',
  source_application_id    INT,                                           -- FK aşağıda
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT employees_first_name_not_empty CHECK (length(trim(first_name)) > 0),
  CONSTRAINT employees_last_name_not_empty  CHECK (length(trim(last_name)) > 0),
  CONSTRAINT employees_employee_no_not_empty CHECK (length(trim(employee_no)) > 0),
  CONSTRAINT employees_tc_kimlik_len CHECK (tc_kimlik IS NULL OR length(tc_kimlik) = 11),
  CONSTRAINT employees_termination_after_hire
    CHECK (termination_date IS NULL OR termination_date >= hire_date),
  CONSTRAINT employees_terminated_has_date
    CHECK (status <> 'terminated' OR termination_date IS NOT NULL)
);

-- Bir User en fazla bir Employee'ye bağlı olabilir (ADR-0005).
CREATE UNIQUE INDEX uq_employees_user
  ON employees(user_id) WHERE user_id IS NOT NULL;

-- Şirket içi employee_no benzersizliği
CREATE UNIQUE INDEX uq_employees_company_employee_no
  ON employees(company_id, employee_no);

-- TC Kimlik şirket içinde benzersiz (NULL hariç)
CREATE UNIQUE INDEX uq_employees_company_tc_kimlik
  ON employees(company_id, tc_kimlik) WHERE tc_kimlik IS NOT NULL;

-- Aktif çalışan listeleri için
CREATE INDEX idx_employees_company_status
  ON employees(company_id, status);
CREATE INDEX idx_employees_department
  ON employees(department_id);
CREATE INDEX idx_employees_position
  ON employees(position_id);

CREATE TRIGGER employees_updated_at BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();


-- Geç bağlanan FK'ler ----------------------------------------------------------

-- departments.manager_employee_id → employees(id)
-- DEFERRABLE değil: department'a manager atamadan da kullanılabilir (nullable).
-- Cycle riski yok çünkü manager bir Employee, Department değil.
ALTER TABLE departments
  ADD CONSTRAINT fk_departments_manager
  FOREIGN KEY (manager_employee_id) REFERENCES employees(id) ON DELETE SET NULL;


-- ============================================================================
-- CANDIDATES — işe alım aday havuzu (şirket bazlı).
-- Bir kişi farklı pozisyonlara başvurabilir → Candidate ayrı varlık.
-- ============================================================================
CREATE TYPE candidate_source AS ENUM (
  'referral', 'linkedin', 'jobboard', 'direct', 'agency', 'other'
);

CREATE TABLE candidates (
  id           SERIAL PRIMARY KEY,
  company_id   INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  first_name   VARCHAR(100) NOT NULL,
  last_name    VARCHAR(100) NOT NULL,
  email        CITEXT,
  phone        VARCHAR(32),
  source       candidate_source NOT NULL DEFAULT 'direct',
  cv_url       TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT candidates_first_name_not_empty CHECK (length(trim(first_name)) > 0),
  CONSTRAINT candidates_last_name_not_empty  CHECK (length(trim(last_name)) > 0)
);

CREATE INDEX idx_candidates_company_email
  ON candidates(company_id, email);
CREATE INDEX idx_candidates_company_source
  ON candidates(company_id, source);

CREATE TRIGGER candidates_updated_at BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();


-- ============================================================================
-- APPLICATIONS — bir Candidate'in bir Position'a başvurusu.
-- Stage durum makinesi: new → screening → interview → offer → hired/rejected/withdrawn
-- ============================================================================
CREATE TYPE recruitment_stage AS ENUM (
  'new', 'screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn'
);

CREATE TABLE applications (
  id                  SERIAL PRIMARY KEY,
  company_id          INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  candidate_id        INT NOT NULL REFERENCES candidates(id) ON DELETE RESTRICT,
  position_id         INT NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
  stage               recruitment_stage NOT NULL DEFAULT 'new',
  stage_changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stage_changed_by    INT REFERENCES users(id) ON DELETE SET NULL,
  rejection_reason    TEXT,
  salary_expectation  NUMERIC(20, 2),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bir aday aynı pozisyona "aktif" iken bir kez başvurabilir
-- (terminal stage'ler — hired/rejected/withdrawn — yeniden başvuruya izin verir).
CREATE UNIQUE INDEX uq_applications_active_unique
  ON applications(candidate_id, position_id)
  WHERE stage NOT IN ('hired', 'rejected', 'withdrawn');

CREATE INDEX idx_applications_company_position_stage
  ON applications(company_id, position_id, stage);
CREATE INDEX idx_applications_candidate
  ON applications(candidate_id);

CREATE TRIGGER applications_updated_at BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();


-- employees.source_application_id → applications.id
-- (İşe alım → employee oluşumu izi.)
ALTER TABLE employees
  ADD CONSTRAINT fk_employees_source_application
  FOREIGN KEY (source_application_id) REFERENCES applications(id) ON DELETE SET NULL;


-- ============================================================================
-- APPLICATION_STAGE_HISTORY — audit trail.
-- Bir Application'ın stage'i her değiştiğinde otomatik satır eklenir (trigger).
-- ============================================================================
CREATE TABLE application_stage_history (
  id              BIGSERIAL PRIMARY KEY,
  application_id  INT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  from_stage      recruitment_stage,                  -- INSERT'te NULL
  to_stage        recruitment_stage NOT NULL,
  changed_by      INT REFERENCES users(id) ON DELETE SET NULL,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note            TEXT
);

CREATE INDEX idx_application_stage_history_app
  ON application_stage_history(application_id, changed_at DESC);


-- Stage geçişlerini history'ye yazan trigger.
-- Domain'deki ApplicationStageTransitionPolicy daha katı kontroller yapacak;
-- bu trigger sadece izi otomatik tutar.
CREATE OR REPLACE FUNCTION trg_applications_stage_history()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO application_stage_history (application_id, from_stage, to_stage, changed_by, changed_at)
    VALUES (NEW.id, NULL, NEW.stage, NEW.stage_changed_by, NEW.stage_changed_at);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO application_stage_history (application_id, from_stage, to_stage, changed_by, changed_at)
    VALUES (NEW.id, OLD.stage, NEW.stage, NEW.stage_changed_by, NEW.stage_changed_at);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER applications_stage_history
  AFTER INSERT OR UPDATE OF stage ON applications
  FOR EACH ROW EXECUTE FUNCTION trg_applications_stage_history();


-- ============================================================================
-- Yorumlar (dökümantasyon)
-- ============================================================================
COMMENT ON TABLE org_units IS
  'Faz 4: organizasyon hiyerarşisi — şirket altında bölüm/birim ağacı.';
COMMENT ON TABLE departments IS
  'Faz 4: org_unit veya company''ye bağlı departman. Manager opsiyonel.';
COMMENT ON TABLE positions IS
  'Faz 4: job title kütüphanesi. Status open = işe alım açık.';
COMMENT ON TABLE employees IS
  'Faz 4: çalışan sicili. user_id NULL olabilir (ADR-0005).';
COMMENT ON TABLE candidates IS
  'Faz 4: işe alım aday havuzu. Şirket bazlı.';
COMMENT ON TABLE applications IS
  'Faz 4: Candidate''in Position''a başvurusu. Stage durum makinesi.';
COMMENT ON TABLE application_stage_history IS
  'Faz 4: applications.stage değişikliklerinin otomatik audit trail''i (trigger).';
