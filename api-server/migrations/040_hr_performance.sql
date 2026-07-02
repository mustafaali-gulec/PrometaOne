-- ============================================================================
-- 040_hr_performance.sql
-- Prometa One — HR Performans Yönetimi: değerlendirme dönemleri (hr_perf_cycles)
-- ve çalışan×dönem değerlendirmeleri (hr_perf_reviews).
--
-- Kaynak-of-truth UI tarafında app-state blob'udur (hrPerfCycles/hrPerfReviews);
-- bu tablolar /v1/performance/sync ile yazılan SQL-sorgulanabilir aynadır
-- (Report Studio + API erişimi). id'ler istemci-üretimi string'lerdir
-- (pc_*/pf_*); employee_id blob'daki hrEmployees[].id'ye işaret eder (FK yok —
-- çalışanlar normalize tabloda değil). trg_updated_at() zaten var (001).
-- ============================================================================

CREATE TABLE hr_perf_cycles (
  id                   VARCHAR(60) PRIMARY KEY,
  company_id           INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name                 VARCHAR(200) NOT NULL,
  period_start         DATE,
  period_end           DATE,
  status               VARCHAR(20) NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','active','calibration','closed')),
  self_assessment      BOOLEAN NOT NULL DEFAULT TRUE,
  competencies_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  scale_max            INT NOT NULL DEFAULT 5  CHECK (scale_max BETWEEN 1 AND 100),
  weight_goals         INT NOT NULL DEFAULT 60 CHECK (weight_goals BETWEEN 0 AND 100),
  weight_competencies  INT NOT NULL DEFAULT 40 CHECK (weight_competencies BETWEEN 0 AND 100),
  competency_defs      JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by           VARCHAR(80),
  activated_at         TIMESTAMPTZ,
  closed_at            TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hr_perf_cycles_company ON hr_perf_cycles(company_id, status);
CREATE TRIGGER hr_perf_cycles_updated_at BEFORE UPDATE ON hr_perf_cycles
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

CREATE TABLE hr_perf_reviews (
  id                      VARCHAR(60) PRIMARY KEY,
  company_id              INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cycle_id                VARCHAR(60) NOT NULL REFERENCES hr_perf_cycles(id) ON DELETE CASCADE,
  employee_id             VARCHAR(60) NOT NULL,
  reviewer_user_id        VARCHAR(80),
  status                  VARCHAR(24) NOT NULL DEFAULT 'self_pending'
                            CHECK (status IN ('self_pending','self_submitted','manager_pending','completed','acknowledged')),
  goals                   JSONB NOT NULL DEFAULT '[]'::jsonb,
  competencies            JSONB NOT NULL DEFAULT '[]'::jsonb,
  self_overall_comment    TEXT NOT NULL DEFAULT '',
  manager_overall_comment TEXT NOT NULL DEFAULT '',
  self_submitted_at       TIMESTAMPTZ,
  manager_submitted_at    TIMESTAMPTZ,
  manager_user_id         VARCHAR(80),
  overall_score           NUMERIC(6,2) NOT NULL DEFAULT 0,
  rating_key              VARCHAR(20)
                            CHECK (rating_key IS NULL OR rating_key IN ('outstanding','exceeds','meets','partially','below')),
  calibrated_rating_key   VARCHAR(20)
                            CHECK (calibrated_rating_key IS NULL OR calibrated_rating_key IN ('outstanding','exceeds','meets','partially','below')),
  acknowledged_at         TIMESTAMPTZ,
  acknowledged_by         VARCHAR(80),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, cycle_id, employee_id)
);

CREATE INDEX idx_hr_perf_reviews_company_cycle ON hr_perf_reviews(company_id, cycle_id);
CREATE INDEX idx_hr_perf_reviews_employee ON hr_perf_reviews(company_id, employee_id);
CREATE TRIGGER hr_perf_reviews_updated_at BEFORE UPDATE ON hr_perf_reviews
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();
