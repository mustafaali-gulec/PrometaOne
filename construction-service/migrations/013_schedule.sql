-- ============================================================================
-- 013_schedule.sql — FAZ 8: İŞ PROGRAMI (Gantt + S-eğrisi)
--
-- Imperium'un İş Programı ekranı: aktivite listesi (WBS), Gantt çubukları ve
-- planlanan/fiili S-eğrisi.
--
-- İKİ TABLO:
--   cs_schedule_activities   — aktiviteler (grup/iş/kilometre taşı, WBS ağacı)
--   cs_schedule_progress_log — ilerleme GÜNLÜĞÜ (fiili S-eğrisinin kaynağı)
--
-- FİİLİ S-EĞRİSİ NEDEN GÜNLÜKTEN: aktivitede yalnız güncel progress_pct
-- tutulsaydı "geçen ay neredeydik" sorusu cevapsız kalır ve fiili eğri
-- çizilemezdi. Her ilerleme güncellemesi (activity_id, as_of) anahtarıyla
-- günlüğe düşer; aynı güne ikinci güncelleme ÜZERİNE YAZAR (düzeltmedir,
-- yeni ölçüm değil). Eğri bu anlık görüntülerden çizilir — geriye dönük
-- "uydurulmuş" fiili eğri yoktur, kayıt yoksa eğri de yoktur.
--
-- PLANLANAN EĞRİ ise kayıttan değil HESAPTAN gelir: aktivitenin ağırlığı,
-- planlanan süresine doğrusal yayılır (use-case katmanında; SQL'de tarih
-- serisi üretmek yerine TS'te — birim testi yazılabilir olsun).
-- ============================================================================

CREATE TABLE cs_schedule_activities (
  id             BIGSERIAL PRIMARY KEY,
  company_id     INT    NOT NULL,
  project_id     BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  -- WBS ağacı: grup satırları başlık/rollup'tır, eğriye ve toplam ağırlığa
  -- yalnız YAPRAKLAR (task/milestone) girer.
  parent_id      BIGINT REFERENCES cs_schedule_activities(id) ON DELETE CASCADE,
  code           VARCHAR(40)  NOT NULL,
  name           VARCHAR(300) NOT NULL,
  kind           VARCHAR(20)  NOT NULL DEFAULT 'task',
  planned_start  DATE NOT NULL,
  planned_end    DATE NOT NULL,
  actual_start   DATE,
  actual_end     DATE,
  progress_pct   NUMERIC(5,2) NOT NULL DEFAULT 0,
  -- S-eğrisi ağırlığı. Tümü 0 ise use-case süre-orantılı ağırlığa düşer —
  -- kullanıcı ağırlık girmeden de eğri çizilebilsin.
  weight_pct     NUMERIC(9,4) NOT NULL DEFAULT 0,
  -- Fiziksel ilerleme köprüsü: bağlı takibin güncel yüzdesi ekranda referans
  -- olarak gösterilir ve tek tıkla aktiviteye çekilebilir. Otomatik senkron
  -- YOK — iş programı yüzdesi taahhüt edilmiş bir beyandır, takip ise saha
  -- ölçümüdür; ikisini sessizce eşitlemek beyanı ölçümle ezerdi.
  tracking_id    BIGINT REFERENCES cs_trackings(id) ON DELETE SET NULL,
  boq_line_id    BIGINT REFERENCES cs_boq_lines(id) ON DELETE SET NULL,
  location_id    BIGINT REFERENCES cs_locations(id) ON DELETE SET NULL,
  -- Tek FS (bitir-başla) öncülü: pratik Gantt'ların %90'ı bununla çizilir;
  -- çoklu bağımlılık matrisi bu fazın kapsamı dışında.
  depends_on     BIGINT REFERENCES cs_schedule_activities(id) ON DELETE SET NULL,
  sort_order     INT NOT NULL DEFAULT 0,
  note           TEXT,
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_by     INT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cs_sched_code_uq UNIQUE (company_id, project_id, code),
  CONSTRAINT cs_sched_kind_chk CHECK (kind IN ('group', 'task', 'milestone')),
  CONSTRAINT cs_sched_dates_chk CHECK (planned_start <= planned_end),
  CONSTRAINT cs_sched_actual_chk CHECK (
    actual_end IS NULL OR actual_start IS NULL OR actual_start <= actual_end),
  -- Fiili bitiş fiili başlangıçsız olamaz: "bitti ama ne zaman başladı belli
  -- değil" satırı gecikme analizini imkânsız kılar.
  CONSTRAINT cs_sched_end_needs_start CHECK (actual_end IS NULL OR actual_start IS NOT NULL),
  CONSTRAINT cs_sched_pct_chk CHECK (progress_pct >= 0 AND progress_pct <= 100),
  CONSTRAINT cs_sched_weight_chk CHECK (weight_pct >= 0),
  -- Kilometre taşının süresi yoktur
  CONSTRAINT cs_sched_milestone_chk CHECK (kind <> 'milestone' OR planned_start = planned_end),
  CONSTRAINT cs_sched_no_self_dep CHECK (depends_on IS NULL OR depends_on <> id)
);

CREATE INDEX idx_cs_sched_project ON cs_schedule_activities(company_id, project_id, sort_order);
CREATE INDEX idx_cs_sched_parent  ON cs_schedule_activities(parent_id) WHERE parent_id IS NOT NULL;

COMMENT ON TABLE cs_schedule_activities IS
  'İş programı aktiviteleri (Faz 8). Eğriye ve ağırlığa yalnız yapraklar girer; grup satırı rollup.';
COMMENT ON COLUMN cs_schedule_activities.tracking_id IS
  'Fiziksel ilerleme köprüsü — referans + tek tıkla çekme. Otomatik senkron yok: program yüzdesi beyandır, takip ölçümdür.';

-- İlerleme günlüğü: her güncelleme bir anlık görüntü. Fiili S-eğrisi buradan.
CREATE TABLE cs_schedule_progress_log (
  id           BIGSERIAL PRIMARY KEY,
  company_id   INT    NOT NULL,
  activity_id  BIGINT NOT NULL REFERENCES cs_schedule_activities(id) ON DELETE CASCADE,
  as_of        DATE   NOT NULL,
  progress_pct NUMERIC(5,2) NOT NULL,
  note         VARCHAR(500),
  created_by   INT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cs_splog_pct_chk CHECK (progress_pct >= 0 AND progress_pct <= 100),
  -- Aynı güne ikinci kayıt ÜZERİNE YAZILIR (upsert) — düzeltmedir, yeni ölçüm değil.
  CONSTRAINT cs_splog_uq UNIQUE (activity_id, as_of)
);

CREATE INDEX idx_cs_splog_activity ON cs_schedule_progress_log(activity_id, as_of);

COMMENT ON TABLE cs_schedule_progress_log IS
  'Aktivite ilerleme anlık görüntüleri — fiili S-eğrisinin tek kaynağı. Kayıt yoksa eğri de yok (geriye dönük uydurma yok).';

-- Proje program özeti: gecikme sayıları liste ekranının üst şeridi için.
CREATE VIEW cs_v_schedule_summary AS
SELECT a.company_id,
       a.project_id,
       COUNT(*) FILTER (WHERE a.kind <> 'group')                            AS task_count,
       COUNT(*) FILTER (WHERE a.kind <> 'group' AND a.progress_pct >= 100)  AS done_count,
       COUNT(*) FILTER (
         WHERE a.kind <> 'group' AND a.progress_pct < 100
           AND a.planned_end < CURRENT_DATE)                                AS overdue_count,
       COUNT(*) FILTER (
         WHERE a.kind <> 'group' AND a.progress_pct = 0
           AND a.planned_start < CURRENT_DATE)                              AS not_started_late_count,
       MIN(a.planned_start) FILTER (WHERE a.kind <> 'group')                AS project_start,
       MAX(a.planned_end)   FILTER (WHERE a.kind <> 'group')                AS project_end
  FROM cs_schedule_activities a
 WHERE a.active
 GROUP BY a.company_id, a.project_id;

COMMENT ON VIEW cs_v_schedule_summary IS
  'Proje program özeti: gecikmiş iş sayısı (bitmemiş + planlanan bitişi geçmiş) ve geç kalan başlangıçlar.';
