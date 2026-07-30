-- 011: FAZ 6 — Kalite & Güvenlik
--
-- Imperium'un dört ekranı: Hasar-Eksiklik · Denetleme (Taşeron Karne Formu) ·
-- Bilgi Talebi (RFI) · Görevlendirme.
--
-- HEPSİ MEKÂN AĞACINA BAĞLI (migration 005). "B blok 4. kat 12 nolu dairede boya
-- eksik" cümlesi ancak location_id ile aranabilir hale gelir; serbest metinle
-- yazılan konum raporlanamaz.
--
-- DÖRT TABLO AYRI, TEK "kayıt" tablosu DEĞİL: günlük raporda (007) tek tablo +
-- kind ayrımı seçilmişti çünkü satırların çoğu aynı alanları paylaşıyordu.
-- Burada tersi geçerli: hasar-eksikliğin giderme/doğrulama döngüsü, denetimin
-- puanlama şeması, RFI'ın soru-cevap+etki alanları ve görevlendirmenin ilerleme
-- yüzdesi ortak alan kümesi kurmuyor. Tek tabloya sıkıştırmak her ekranda
-- yarısı NULL bir satır demekti.

-- ===========================================================================
-- 1) HASAR-EKSİKLİK (punch list)
-- ===========================================================================

CREATE TABLE cs_defects (
  id                    BIGSERIAL PRIMARY KEY,
  company_id            INT    NOT NULL,
  project_id            BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  location_id           BIGINT REFERENCES cs_locations(id) ON DELETE SET NULL,
  code                  VARCHAR(40)  NOT NULL,
  title                 VARCHAR(300) NOT NULL,
  description           TEXT,
  -- Hasar tipi: Imperium'un "hasar tipi" listesi. Serbest metin DEĞİL — tip
  -- bazlı fire/tekrar analizi (hangi imalatta hangi hata tekrar ediyor) ancak
  -- sabit listeyle yapılır.
  defect_kind           VARCHAR(30) NOT NULL,
  -- 5 kademe aciliyet (Imperium ile birebir kademe sayısı)
  severity              VARCHAR(20) NOT NULL DEFAULT 'medium',
  status                VARCHAR(20) NOT NULL DEFAULT 'open',
  -- Sorumlu: taşeron (kart) ve/veya kişi. İkisi de olabilir — taşeron işi
  -- yapar, şantiye mühendisi takip eder.
  vendor_id             BIGINT,
  responsible_user_id   INT,
  reporter_user_id      INT,
  -- Nereden doğdu: denetim maddesi, günlük rapor, müşteri/işveren, iç kontrol
  source                VARCHAR(20) NOT NULL DEFAULT 'internal',
  boq_line_id           BIGINT REFERENCES cs_boq_lines(id) ON DELETE SET NULL,
  due_date              DATE,
  fixed_at              TIMESTAMPTZ,
  fixed_by              INT,
  verified_at           TIMESTAMPTZ,
  verified_by           INT,
  closed_at             TIMESTAMPTZ,
  -- Giderme maliyeti tahmini; kesinti/rücu hesabının girdisi
  cost_estimate         NUMERIC(18,2) NOT NULL DEFAULT 0,
  cost_actual           NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency              VARCHAR(3)   NOT NULL DEFAULT 'TRY',
  -- Kaç kez yeniden açıldı: "giderildi" deyip geçmeyen iş taşeron karnesine
  -- düşer. Sayaç olmadan bu davranış görünmez.
  reopen_count          INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cs_defects_code_uq UNIQUE (company_id, project_id, code),
  CONSTRAINT cs_defects_kind_chk CHECK (defect_kind IN (
    'workmanship', 'missing_work', 'material_damage', 'dimensional',
    'plumbing', 'electrical', 'paint', 'insulation', 'cleaning',
    'safety', 'other')),
  CONSTRAINT cs_defects_severity_chk CHECK (severity IN (
    'very_low', 'low', 'medium', 'high', 'critical')),
  CONSTRAINT cs_defects_status_chk CHECK (status IN (
    'open', 'in_progress', 'fixed', 'verified', 'closed', 'rejected')),
  CONSTRAINT cs_defects_source_chk CHECK (source IN (
    'internal', 'inspection', 'daily_log', 'client', 'rfi')),
  -- Doğrulanmış kayıt gidermeden geçemez: "verified" ama fixed_at boş olan
  -- satır, kimin ne zaman giderdiğini kaybeder.
  CONSTRAINT cs_defects_verify_needs_fix CHECK (
    verified_at IS NULL OR fixed_at IS NOT NULL)
);

CREATE INDEX idx_cs_defects_project  ON cs_defects(company_id, project_id, status);
CREATE INDEX idx_cs_defects_location ON cs_defects(location_id) WHERE location_id IS NOT NULL;
CREATE INDEX idx_cs_defects_vendor   ON cs_defects(company_id, vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX idx_cs_defects_open_due ON cs_defects(company_id, due_date)
  WHERE status IN ('open', 'in_progress', 'fixed');

-- Durum geçmişi: "ne zaman kim açtı/giderdi/reddetti" izi. Hasar-eksiklik
-- listesi taşeronla aradaki en tartışmalı belge; iz olmadan konuşulamaz.
CREATE TABLE cs_defect_history (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INT    NOT NULL,
  defect_id   BIGINT NOT NULL REFERENCES cs_defects(id) ON DELETE CASCADE,
  from_status VARCHAR(20),
  to_status   VARCHAR(20) NOT NULL,
  note        TEXT,
  actor       INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cs_defect_hist ON cs_defect_history(defect_id, created_at);

-- ===========================================================================
-- 2) DENETLEME + TAŞERON KARNE FORMU
-- ===========================================================================

-- Şablon: "Taşeron Karne Formu", "Kalite Kontrol Formu", "İSG Saha Turu".
CREATE TABLE cs_inspection_templates (
  id           BIGSERIAL PRIMARY KEY,
  company_id   INT    NOT NULL,
  code         VARCHAR(40)  NOT NULL,
  name         VARCHAR(300) NOT NULL,
  -- Şablon tipi: karne formu taşerona puan verir, kalite/İSG formu mahalle.
  kind         VARCHAR(30) NOT NULL DEFAULT 'quality',
  description  TEXT,
  -- Puanlama: weighted = madde ağırlıklı puan; pass_fail = uygun/uygun değil
  scoring      VARCHAR(20) NOT NULL DEFAULT 'weighted',
  -- Geçme eşiği (%). Altına düşen denetim "başarısız" sayılır.
  pass_pct     NUMERIC(5,2) NOT NULL DEFAULT 70,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cs_itpl_code_uq UNIQUE (company_id, code),
  CONSTRAINT cs_itpl_kind_chk CHECK (kind IN (
    'quality', 'subcontractor_scorecard', 'hse', 'handover', 'other')),
  CONSTRAINT cs_itpl_scoring_chk CHECK (scoring IN ('weighted', 'pass_fail')),
  CONSTRAINT cs_itpl_pass_chk CHECK (pass_pct >= 0 AND pass_pct <= 100)
);

CREATE TABLE cs_inspection_template_items (
  id           BIGSERIAL PRIMARY KEY,
  company_id   INT    NOT NULL,
  template_id  BIGINT NOT NULL REFERENCES cs_inspection_templates(id) ON DELETE CASCADE,
  category     VARCHAR(120),
  code         VARCHAR(40)  NOT NULL,
  text         VARCHAR(600) NOT NULL,
  weight       NUMERIC(9,4) NOT NULL DEFAULT 1,
  max_score    NUMERIC(9,4) NOT NULL DEFAULT 5,
  -- Kritik madde: sıfır alırsa denetim toplam puandan bağımsız BAŞARISIZ olur
  -- (baret takmamak "diğer maddeler iyiydi" ile telafi edilemez).
  is_critical  BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cs_itpli_code_uq UNIQUE (template_id, code),
  CONSTRAINT cs_itpli_weight_chk CHECK (weight >= 0),
  CONSTRAINT cs_itpli_max_chk CHECK (max_score > 0)
);
CREATE INDEX idx_cs_itpli_tpl ON cs_inspection_template_items(template_id, sort_order);

CREATE TABLE cs_inspections (
  id                BIGSERIAL PRIMARY KEY,
  company_id        INT    NOT NULL,
  project_id        BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  template_id       BIGINT NOT NULL REFERENCES cs_inspection_templates(id),
  location_id       BIGINT REFERENCES cs_locations(id) ON DELETE SET NULL,
  code              VARCHAR(40) NOT NULL,
  -- Denetlenen taşeron (karne formunda zorunlu gibidir ama kalite formunda
  -- olmayabilir; kural uygulama katmanında, şablon tipine göre).
  vendor_id         BIGINT,
  contract_id       BIGINT REFERENCES cs_contracts(id) ON DELETE SET NULL,
  inspector_user_id INT,
  inspection_date   DATE NOT NULL,
  period_label      VARCHAR(40),
  status            VARCHAR(20) NOT NULL DEFAULT 'draft',
  note              TEXT,
  -- Puanlar cevaplardan TÜRETİLİR ama kaydedilir: şablon sonradan değişse
  -- geçmiş denetimin puanı değişmemeli (karne tarihsel bir belgedir).
  total_score       NUMERIC(12,4) NOT NULL DEFAULT 0,
  max_score         NUMERIC(12,4) NOT NULL DEFAULT 0,
  score_pct         NUMERIC(6,2),
  grade             VARCHAR(2),
  passed            BOOLEAN,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cs_insp_code_uq UNIQUE (company_id, code),
  CONSTRAINT cs_insp_status_chk CHECK (status IN ('draft', 'completed', 'approved', 'cancelled')),
  -- Kapanmış denetim puansız olamaz
  CONSTRAINT cs_insp_done_needs_score CHECK (
    status = 'draft' OR status = 'cancelled' OR score_pct IS NOT NULL)
);
CREATE INDEX idx_cs_insp_project ON cs_inspections(company_id, project_id, inspection_date DESC);
CREATE INDEX idx_cs_insp_vendor  ON cs_inspections(company_id, vendor_id) WHERE vendor_id IS NOT NULL;

CREATE TABLE cs_inspection_answers (
  id            BIGSERIAL PRIMARY KEY,
  company_id    INT    NOT NULL,
  inspection_id BIGINT NOT NULL REFERENCES cs_inspections(id) ON DELETE CASCADE,
  item_id       BIGINT NOT NULL REFERENCES cs_inspection_template_items(id),
  -- Madde metni ve ağırlığı KOPYALANIR: şablon sonradan düzenlenirse eski
  -- denetimin neyi puanladığı kaybolmasın.
  item_text     VARCHAR(600) NOT NULL,
  weight        NUMERIC(9,4) NOT NULL DEFAULT 1,
  max_score     NUMERIC(9,4) NOT NULL DEFAULT 5,
  score         NUMERIC(9,4),
  -- Uygulanamaz madde: puanlamadan DÜŞÜLÜR (0 vermek taşeronu cezalandırır).
  is_na         BOOLEAN NOT NULL DEFAULT FALSE,
  note          TEXT,
  -- Başarısız maddeden doğan hasar-eksiklik kaydı. Denetimin işe dönüştüğü yer.
  defect_id     BIGINT REFERENCES cs_defects(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cs_ians_uq UNIQUE (inspection_id, item_id),
  CONSTRAINT cs_ians_score_chk CHECK (score IS NULL OR (score >= 0 AND score <= max_score)),
  -- Uygulanamaz madde puanlanamaz
  CONSTRAINT cs_ians_na_no_score CHECK (NOT is_na OR score IS NULL)
);
CREATE INDEX idx_cs_ians_insp ON cs_inspection_answers(inspection_id);

-- ===========================================================================
-- 3) BİLGİ TALEBİ (RFI)
-- ===========================================================================

CREATE TABLE cs_rfis (
  id                BIGSERIAL PRIMARY KEY,
  company_id        INT    NOT NULL,
  project_id        BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  location_id       BIGINT REFERENCES cs_locations(id) ON DELETE SET NULL,
  code              VARCHAR(40)  NOT NULL,
  subject           VARCHAR(300) NOT NULL,
  question          TEXT NOT NULL,
  -- Disiplin: mimari/statik/mekanik/elektrik/altyapı — cevap verecek kişiyi
  -- ve gecikmenin hangi imalatı beklettiğini belirler.
  discipline        VARCHAR(30) NOT NULL DEFAULT 'architectural',
  priority          VARCHAR(20) NOT NULL DEFAULT 'medium',
  status            VARCHAR(20) NOT NULL DEFAULT 'open',
  asked_by          INT,
  asked_to_user_id  INT,
  vendor_id         BIGINT,
  boq_line_id       BIGINT REFERENCES cs_boq_lines(id) ON DELETE SET NULL,
  due_date          DATE,
  answer            TEXT,
  answered_by       INT,
  answered_at       TIMESTAMPTZ,
  closed_at         TIMESTAMPTZ,
  -- SÜRE VE MALİYET ETKİSİ: kamu ihalesinde süre uzatımı talebinin dayanağı
  -- cevapsız kalan RFI'lardır. Etkisi kaydedilmezse talep belgelenemez.
  impact_days       INT NOT NULL DEFAULT 0,
  impact_cost       NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency          VARCHAR(3) NOT NULL DEFAULT 'TRY',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cs_rfis_code_uq UNIQUE (company_id, project_id, code),
  CONSTRAINT cs_rfis_disc_chk CHECK (discipline IN (
    'architectural', 'structural', 'mechanical', 'electrical',
    'infrastructure', 'landscape', 'geotechnical', 'other')),
  CONSTRAINT cs_rfis_prio_chk CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  CONSTRAINT cs_rfis_status_chk CHECK (status IN ('open', 'answered', 'closed', 'cancelled')),
  -- Cevaplanmış RFI cevapsız olamaz. KAPATMA için cevap ŞART DEĞİL: soru
  -- geçersizleşerek de kapanır (imalat değişti, artık sorulmuyor).
  CONSTRAINT cs_rfis_answered_needs_answer CHECK (
    status <> 'answered' OR answer IS NOT NULL)
);
CREATE INDEX idx_cs_rfis_project ON cs_rfis(company_id, project_id, status);
CREATE INDEX idx_cs_rfis_open_due ON cs_rfis(company_id, due_date) WHERE status = 'open';

-- ===========================================================================
-- 4) GÖREVLENDİRME
-- ===========================================================================

-- Monolitin görev sistemiyle İKİZ DEĞİL: buradaki görevlendirme mekân ağacına
-- ve bir kaynak belgeye (hasar-eksiklik / RFI / denetim / günlük rapor) bağlı
-- saha işidir; kaynak bağı olmayan bir görev bu tabloda yeri olmayan bir
-- kayıttır. Kaynak bağı polimorfik (source_kind + source_id), FK yok — kaynak
-- silinse bile "şu iş verilmişti" izi kalmalı.
CREATE TABLE cs_assignments (
  id                  BIGSERIAL PRIMARY KEY,
  company_id          INT    NOT NULL,
  project_id          BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  location_id         BIGINT REFERENCES cs_locations(id) ON DELETE SET NULL,
  code                VARCHAR(40)  NOT NULL,
  title               VARCHAR(300) NOT NULL,
  description         TEXT,
  assigned_to_user_id INT,
  vendor_id           BIGINT,
  assigned_by         INT,
  priority            VARCHAR(20) NOT NULL DEFAULT 'medium',
  status              VARCHAR(20) NOT NULL DEFAULT 'open',
  start_date          DATE,
  due_date            DATE,
  done_at             TIMESTAMPTZ,
  progress_pct        NUMERIC(5,2) NOT NULL DEFAULT 0,
  source_kind         VARCHAR(20),
  source_id           BIGINT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cs_asg_code_uq UNIQUE (company_id, project_id, code),
  CONSTRAINT cs_asg_prio_chk CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  CONSTRAINT cs_asg_status_chk CHECK (status IN ('open', 'in_progress', 'done', 'cancelled')),
  CONSTRAINT cs_asg_pct_chk CHECK (progress_pct >= 0 AND progress_pct <= 100),
  CONSTRAINT cs_asg_source_chk CHECK (source_kind IS NULL OR source_kind IN (
    'defect', 'rfi', 'inspection', 'daily_log', 'tracking')),
  -- Kaynak tipi varsa kimliği de olmalı (yarım referans aramada bulunmaz)
  CONSTRAINT cs_asg_source_pair CHECK ((source_kind IS NULL) = (source_id IS NULL)),
  -- Bitmiş görev %100'dür; "tamamlandı ama %60" satırı raporda çelişki üretir
  CONSTRAINT cs_asg_done_full CHECK (status <> 'done' OR progress_pct = 100)
);
CREATE INDEX idx_cs_asg_project ON cs_assignments(company_id, project_id, status);
CREATE INDEX idx_cs_asg_user    ON cs_assignments(company_id, assigned_to_user_id, status);
CREATE INDEX idx_cs_asg_source  ON cs_assignments(source_kind, source_id)
  WHERE source_kind IS NOT NULL;

-- ===========================================================================
-- 5) ORTAK EK DOSYASI (fotoğraf)
-- ===========================================================================

-- Hasar-eksikliğin fotoğrafı kanıttır; denetimin, RFI'ın ve görevlendirmenin de
-- eki olur. Dört ayrı dosya tablosu yerine POLİMORFİK tek tablo: dört ekranda
-- aynı yükleme/listeleme kodu çalışır.
CREATE TABLE cs_quality_files (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INT    NOT NULL,
  doc_kind    VARCHAR(20) NOT NULL,
  doc_id      BIGINT NOT NULL,
  file_kind   VARCHAR(20) NOT NULL DEFAULT 'photo',
  -- "Öncesi/sonrası": giderme kanıtı, hasar fotoğrafından ayırt edilmeli
  stage       VARCHAR(20) NOT NULL DEFAULT 'before',
  title       VARCHAR(300),
  file_url    VARCHAR(1000),
  content     BYTEA,
  mime_type   VARCHAR(100),
  size_bytes  INT,
  created_by  INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cs_qf_kind_chk CHECK (doc_kind IN ('defect', 'inspection', 'rfi', 'assignment')),
  CONSTRAINT cs_qf_stage_chk CHECK (stage IN ('before', 'after', 'other')),
  CONSTRAINT cs_qf_has_payload CHECK (file_url IS NOT NULL OR content IS NOT NULL)
);
CREATE INDEX idx_cs_qf_doc ON cs_quality_files(company_id, doc_kind, doc_id);

-- ===========================================================================
-- 6) GÖRÜNÜMLER
-- ===========================================================================

-- Proje/lokasyon bazında hasar-eksiklik tablosu: açık/gecikmiş sayıları ve
-- aciliyet dağılımı. Şantiye şefinin sabah baktığı ekran.
CREATE VIEW cs_v_defect_summary AS
SELECT d.company_id,
       d.project_id,
       d.location_id,
       COUNT(*)                                                        AS total,
       COUNT(*) FILTER (WHERE d.status IN ('open', 'in_progress'))      AS open_count,
       COUNT(*) FILTER (WHERE d.status = 'fixed')                       AS awaiting_verify,
       COUNT(*) FILTER (WHERE d.status IN ('verified', 'closed'))        AS closed_count,
       COUNT(*) FILTER (WHERE d.status = 'rejected')                    AS rejected_count,
       COUNT(*) FILTER (WHERE d.severity = 'critical')                  AS critical_count,
       COUNT(*) FILTER (WHERE d.severity = 'high')                      AS high_count,
       -- Gecikmiş = kapanmamış VE bitiş tarihi geçmiş
       COUNT(*) FILTER (
         WHERE d.status NOT IN ('verified', 'closed', 'rejected')
           AND d.due_date IS NOT NULL AND d.due_date < CURRENT_DATE)    AS overdue_count,
       COUNT(*) FILTER (WHERE d.reopen_count > 0)                       AS reopened_count,
       COALESCE(SUM(d.cost_estimate), 0)                                AS cost_estimate_total,
       COALESCE(SUM(d.cost_actual), 0)                                  AS cost_actual_total,
       -- Ortalama giderme süresi (gün): yalnız gerçekten giderilenler
       AVG(EXTRACT(EPOCH FROM (d.fixed_at - d.created_at)) / 86400.0)
         FILTER (WHERE d.fixed_at IS NOT NULL)                          AS avg_fix_days
  FROM cs_defects d
 GROUP BY d.company_id, d.project_id, d.location_id;

-- TAŞERON KARNESİ. Imperium'un "Taşeron Karne Formu"nun raporu: denetim puanı
-- ortalaması + hasar-eksiklik davranışı tek satırda.
--
-- Denetim ve hasar sayıları AYRI ALT SORGULARDAN gelir; tek JOIN ile yazılırsa
-- taşeronun 3 denetimi ve 10 hasarı çarpışıp 30 satır üretir ve ortalamalar
-- bozulur (klasik fan-out hatası).
CREATE VIEW cs_v_vendor_scorecard AS
WITH insp AS (
  SELECT i.company_id, i.vendor_id, i.project_id,
         COUNT(*)                                       AS inspection_count,
         AVG(i.score_pct)                               AS avg_score_pct,
         MIN(i.score_pct)                               AS min_score_pct,
         MAX(i.inspection_date)                         AS last_inspection_date,
         COUNT(*) FILTER (WHERE i.passed IS FALSE)      AS failed_count
    FROM cs_inspections i
   WHERE i.status IN ('completed', 'approved') AND i.vendor_id IS NOT NULL
   GROUP BY i.company_id, i.vendor_id, i.project_id
), defs AS (
  SELECT d.company_id, d.vendor_id, d.project_id,
         COUNT(*)                                                    AS defect_count,
         COUNT(*) FILTER (WHERE d.status NOT IN ('verified', 'closed', 'rejected'))
                                                                     AS defect_open,
         COUNT(*) FILTER (
           WHERE d.status NOT IN ('verified', 'closed', 'rejected')
             AND d.due_date IS NOT NULL AND d.due_date < CURRENT_DATE) AS defect_overdue,
         COUNT(*) FILTER (WHERE d.severity IN ('high', 'critical'))   AS defect_severe,
         SUM(d.reopen_count)                                         AS reopen_total,
         AVG(EXTRACT(EPOCH FROM (d.fixed_at - d.created_at)) / 86400.0)
           FILTER (WHERE d.fixed_at IS NOT NULL)                     AS avg_fix_days
    FROM cs_defects d
   WHERE d.vendor_id IS NOT NULL
   GROUP BY d.company_id, d.vendor_id, d.project_id
)
SELECT COALESCE(i.company_id, d.company_id)   AS company_id,
       COALESCE(i.vendor_id, d.vendor_id)     AS vendor_id,
       COALESCE(i.project_id, d.project_id)   AS project_id,
       v.name                                 AS vendor_name,
       COALESCE(i.inspection_count, 0)        AS inspection_count,
       i.avg_score_pct,
       i.min_score_pct,
       i.last_inspection_date,
       COALESCE(i.failed_count, 0)            AS failed_inspection_count,
       COALESCE(d.defect_count, 0)            AS defect_count,
       COALESCE(d.defect_open, 0)             AS defect_open,
       COALESCE(d.defect_overdue, 0)          AS defect_overdue,
       COALESCE(d.defect_severe, 0)           AS defect_severe,
       COALESCE(d.reopen_total, 0)            AS reopen_total,
       d.avg_fix_days
  FROM insp i
  FULL OUTER JOIN defs d
    ON d.company_id = i.company_id AND d.vendor_id = i.vendor_id AND d.project_id = i.project_id
  LEFT JOIN cs_ref_vendors v ON v.id = COALESCE(i.vendor_id, d.vendor_id);

-- RFI paneli: cevap süresi ve cevapsız beklemenin süre etkisi.
CREATE VIEW cs_v_rfi_summary AS
SELECT r.company_id,
       r.project_id,
       COUNT(*)                                                       AS total,
       COUNT(*) FILTER (WHERE r.status = 'open')                       AS open_count,
       COUNT(*) FILTER (WHERE r.status = 'answered')                   AS answered_count,
       COUNT(*) FILTER (WHERE r.status = 'closed')                     AS closed_count,
       COUNT(*) FILTER (
         WHERE r.status = 'open'
           AND r.due_date IS NOT NULL AND r.due_date < CURRENT_DATE)    AS overdue_count,
       -- Cevap süresi yalnız cevaplananlarda ölçülür; açık RFI'ı 0 gün saymak
       -- ortalamayı iyi gösterir.
       AVG(EXTRACT(EPOCH FROM (r.answered_at - r.created_at)) / 86400.0)
         FILTER (WHERE r.answered_at IS NOT NULL)                      AS avg_answer_days,
       -- Açıkta bekleyen RFI'ların yaşı: süre uzatımı talebinin dayanağı
       MAX(CURRENT_DATE - r.created_at::date) FILTER (WHERE r.status = 'open')
                                                                       AS oldest_open_days,
       COALESCE(SUM(r.impact_days), 0)                                 AS impact_days_total,
       COALESCE(SUM(r.impact_cost), 0)                                 AS impact_cost_total
  FROM cs_rfis r
 GROUP BY r.company_id, r.project_id;

CREATE VIEW cs_v_assignment_summary AS
SELECT a.company_id,
       a.project_id,
       a.assigned_to_user_id,
       COUNT(*)                                                       AS total,
       COUNT(*) FILTER (WHERE a.status = 'open')                       AS open_count,
       COUNT(*) FILTER (WHERE a.status = 'in_progress')                AS in_progress_count,
       COUNT(*) FILTER (WHERE a.status = 'done')                       AS done_count,
       COUNT(*) FILTER (
         WHERE a.status IN ('open', 'in_progress')
           AND a.due_date IS NOT NULL AND a.due_date < CURRENT_DATE)    AS overdue_count,
       AVG(a.progress_pct) FILTER (WHERE a.status <> 'cancelled')      AS avg_progress_pct
  FROM cs_assignments a
 GROUP BY a.company_id, a.project_id, a.assigned_to_user_id;

COMMENT ON TABLE cs_defects IS
  'Hasar-Eksiklik (punch list). Mekân ağacına bağlı; reopen_count "giderildi deyip geçen" işi görünür kılar.';
COMMENT ON TABLE cs_inspection_templates IS
  'Denetim şablonu. kind=subcontractor_scorecard ise Taşeron Karne Formu.';
COMMENT ON COLUMN cs_inspection_answers.item_text IS
  'Madde metni kopyalanır: şablon sonradan değişse eski denetimin neyi puanladığı kaybolmasın.';
COMMENT ON COLUMN cs_inspection_template_items.is_critical IS
  'Kritik madde 0 alırsa denetim toplam puandan bağımsız başarısız olur.';
COMMENT ON TABLE cs_rfis IS
  'Bilgi Talebi. impact_days/impact_cost süre uzatımı talebinin belgesel dayanağıdır.';
COMMENT ON TABLE cs_assignments IS
  'Saha görevlendirmesi. Kaynak belgeye polimorfik bağlanır (source_kind+source_id); monolit görev sisteminin ikizi DEĞİL.';
COMMENT ON VIEW cs_v_vendor_scorecard IS
  'Taşeron karnesi: denetim puanı + hasar-eksiklik davranışı. Denetim ve hasar ayrı CTE - tek JOIN fan-out üretirdi.';
