-- ============================================================================
-- 007_daily_log.sql — FAZ 3: ŞANTİYE GÜNLÜĞÜ (Günlük Rapor)
--
-- Şantiyede günlük rapor hukuki ve teknik bir kayıttır: hangi gün çalışıldı,
-- kim kaç saat çalıştı, ne imal edildi, hangi malzeme tüketildi, kaza oldu mu.
-- Bugüne kadar bu bilgi modülde parça parça duruyordu (cs_timesheets ve
-- cs_machine_logs) ve şu alanların hiç karşılığı yoktu:
--   hava durumu / çalışılmayan gün · taşeron günlük kişi-saat · imalat miktarı ·
--   tüketilen malzeme · sipariş teslimat (irsaliye) · KAZA (İSG) · yakıt/sarf ·
--   bakım-servis · ziyaretçi
--
-- Model: gün başlığı (cs_daily_logs) + çok tipli satırlar (cs_daily_log_entries).
-- Tek tablo + `kind` ayrımı seçildi çünkü satırların %80'i aynı alanları
-- paylaşıyor (mekân, açıklama, saat, miktar, ek, yorum) ve saha ekranı hepsini
-- tek sorguda okuyup tek listede gösteriyor. 11 ayrı tablo, 11 ayrı JOIN ve
-- 11 ayrı CRUD demekti.
--
-- GÜN KİLİDİ: rapor kilitlenince satır eklenemez/değişmez — ıslak imzalı günlük
-- raporun dijital karşılığı. Kilit açma ayrı bir yetki ister (route katmanında).
--
-- KÖPRÜLER (ikiz veri girişini önlemek için):
--   personnel satırı → cs_timesheets   (puantaj/maliyet tek kaynaktan)
--   equipment satırı → cs_machine_logs (makine maliyeti tek kaynaktan)
--   production satırı → boq_line_id / tracking_item_id (gerçekleşen miktar)
-- Bu köprüler use-case katmanında kurulur; DB tarafında yalnız referans tutulur.
-- ============================================================================

CREATE TYPE cs_daily_log_status AS ENUM ('open', 'locked');

-- Günün çalışma durumu. 'partial' = yarım gün (yağmur öğleden sonra kesti gibi).
CREATE TYPE cs_work_state AS ENUM ('working', 'not_working', 'partial');

CREATE TABLE cs_daily_logs (
  id            BIGSERIAL PRIMARY KEY,
  company_id    INT    NOT NULL,
  project_id    BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  log_date      DATE   NOT NULL,
  status        cs_daily_log_status NOT NULL DEFAULT 'open',
  work_state    cs_work_state       NOT NULL DEFAULT 'working',
  -- Hava durumu: sıcaklık + serbest not (yağmur/kar/rüzgâr). Hava servisinden
  -- otomatik doldurulabilir ama kullanıcı düzeltebilir — bu yüzden kolon, view değil.
  temp_c        NUMERIC(5, 1),
  weather_note  VARCHAR(200),
  -- Çalışılmayan gün gerekçesi (tatil, hava, elektrik kesintisi, grev...)
  no_work_reason VARCHAR(200),
  summary       TEXT,
  locked_by     INT,                       -- soft ref → users
  locked_at     TIMESTAMPTZ,
  created_by    INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, project_id, log_date),
  -- Kilitli günde kilitleyen ve zaman zorunlu: "kim kapattı" sorusu cevapsız kalmasın
  CONSTRAINT cs_daily_logs_lock_audit
    CHECK (status = 'open' OR (locked_at IS NOT NULL AND locked_by IS NOT NULL))
);
CREATE INDEX idx_cs_dlog_project_date ON cs_daily_logs(project_id, log_date DESC);
CREATE TRIGGER cs_daily_logs_updated_at
  BEFORE UPDATE ON cs_daily_logs
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- Kayıt tipleri. Imperium'un 11 kayıt türü + ziyaretçi.
CREATE TYPE cs_log_entry_kind AS ENUM (
  'subcontractor',   -- taşeron: firma + konum + kişi + saat + yapılan iş
  'personnel',       -- kendi personeli: ekip + konum + saat  → cs_timesheets
  'equipment',       -- makine: çalışma + rölanti saati       → cs_machine_logs
  'note',            -- serbest not (şantiye şefi tutanağı)
  'delivery',        -- sipariş teslimat: irsaliye no + saat
  'accident',        -- KAZA / ramak kala (İSG)
  'material_used',   -- tüketilen malzeme: miktar + birim
  'production',      -- İMALAT: miktar + birim → keşif/takip gerçekleşeni
  'fuel',            -- ekipman yakıt & sarf malzeme/parça
  'maintenance',     -- ekipman bakım / servis
  'visitor'          -- ziyaretçi (kontrol mühendisi, müşteri, denetim)
);

-- İSG olay şiddeti. 'near_miss' (ramak kala) kasıtlı olarak burada: kaza
-- olmadan önce yakalanan durumlar İSG istatistiğinin en değerli girdisidir.
CREATE TYPE cs_accident_severity AS ENUM (
  'near_miss', 'first_aid', 'medical', 'lost_time', 'fatal'
);

CREATE TABLE cs_daily_log_entries (
  id             BIGSERIAL PRIMARY KEY,
  company_id     INT    NOT NULL,
  log_id         BIGINT NOT NULL REFERENCES cs_daily_logs(id) ON DELETE CASCADE,
  kind           cs_log_entry_kind NOT NULL,

  -- NEREDE (Faz 1 mekân ağacı)
  location_id    BIGINT REFERENCES cs_locations(id) ON DELETE SET NULL,

  -- KİM / NE (tipine göre biri doldurulur; hepsi nullable)
  vendor_id      BIGINT,                                              -- soft ref → vendors
  personnel_id   BIGINT REFERENCES cs_personnel(id)      ON DELETE SET NULL,
  machine_id     BIGINT REFERENCES cs_machines(id)       ON DELETE SET NULL,
  material_id    BIGINT REFERENCES cs_materials(id)      ON DELETE SET NULL,
  boq_line_id    BIGINT REFERENCES cs_boq_lines(id)      ON DELETE SET NULL,
  tracking_item_id BIGINT REFERENCES cs_tracking_items(id) ON DELETE SET NULL,
  crew_name      VARCHAR(100),      -- ekip adı; boşsa "ekipsiz"
  person_name    VARCHAR(200),      -- kadro dışı kişi (ziyaretçi, taşeron işçisi)
  description    VARCHAR(1000),

  -- ÖLÇÜLER
  headcount      INT            CHECK (headcount  IS NULL OR headcount  >= 0),
  hours          NUMERIC(7, 2)  CHECK (hours      IS NULL OR hours      >= 0),
  idle_hours     NUMERIC(7, 2)  CHECK (idle_hours IS NULL OR idle_hours >= 0),
  qty            NUMERIC(20, 3) CHECK (qty        IS NULL OR qty        >= 0),
  unit           VARCHAR(20),
  amount         NUMERIC(20, 2) CHECK (amount     IS NULL OR amount     >= 0),
  currency       currency_code  NOT NULL DEFAULT 'TRY',

  -- TESLİMAT / ZAMAN
  waybill_no     VARCHAR(60),       -- irsaliye / sevk no
  occurred_at    TIME,              -- olay saati (teslimat, kaza, ziyaret)

  -- İSG (kind='accident')
  severity       cs_accident_severity,
  lost_days      INT CHECK (lost_days IS NULL OR lost_days >= 0),

  sort_order     INT NOT NULL DEFAULT 0,
  created_by     INT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Kaza satırı şiddet taşımak zorunda; İSG istatistiği şiddetsiz üretilemez.
  CONSTRAINT cs_dle_accident_needs_severity
    CHECK (kind <> 'accident' OR severity IS NOT NULL),
  -- İmalat ve tüketim satırı miktar+birim taşımak zorunda; "300 imal edildi"
  -- birimi olmadan raporlanamaz.
  CONSTRAINT cs_dle_qty_needs_unit
    CHECK (kind NOT IN ('production', 'material_used') OR (qty IS NOT NULL AND unit IS NOT NULL))
);
CREATE INDEX idx_cs_dle_log        ON cs_daily_log_entries(log_id, kind, sort_order);
CREATE INDEX idx_cs_dle_location   ON cs_daily_log_entries(location_id)  WHERE location_id IS NOT NULL;
CREATE INDEX idx_cs_dle_boq        ON cs_daily_log_entries(boq_line_id)  WHERE boq_line_id IS NOT NULL;
CREATE INDEX idx_cs_dle_vendor     ON cs_daily_log_entries(vendor_id)    WHERE vendor_id IS NOT NULL;
CREATE INDEX idx_cs_dle_machine    ON cs_daily_log_entries(machine_id)   WHERE machine_id IS NOT NULL;
CREATE INDEX idx_cs_dle_personnel  ON cs_daily_log_entries(personnel_id) WHERE personnel_id IS NOT NULL;
CREATE TRIGGER cs_daily_log_entries_updated_at
  BEFORE UPDATE ON cs_daily_log_entries
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- Fotoğraf / döküman. Satıra da güne de bağlanabilir (galeri hem satır ekini
-- hem günün genel fotoğraflarını gösterir).
CREATE TABLE cs_daily_log_files (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INT    NOT NULL,
  log_id      BIGINT NOT NULL REFERENCES cs_daily_logs(id) ON DELETE CASCADE,
  entry_id    BIGINT REFERENCES cs_daily_log_entries(id) ON DELETE CASCADE,
  file_kind   VARCHAR(20) NOT NULL DEFAULT 'photo',   -- photo | doc
  title       VARCHAR(300),
  file_url    VARCHAR(1000),
  content     BYTEA,                                   -- küçük ekler için gömülü
  mime_type   VARCHAR(100),
  size_bytes  INT,
  created_by  INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Ya URL ya gömülü içerik olmalı; ikisi de boş bir ek kaydı anlamsızdır.
  CONSTRAINT cs_dlf_has_payload CHECK (file_url IS NOT NULL OR content IS NOT NULL)
);
CREATE INDEX idx_cs_dlf_log   ON cs_daily_log_files(log_id);
CREATE INDEX idx_cs_dlf_entry ON cs_daily_log_files(entry_id) WHERE entry_id IS NOT NULL;

-- Satır yorumları (Imperium'daki comment sayacı). Saha ile teknik ofis arasındaki
-- yazışma raporun içinde kalsın diye ayrı tablo.
CREATE TABLE cs_daily_log_comments (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INT    NOT NULL,
  log_id      BIGINT NOT NULL REFERENCES cs_daily_logs(id) ON DELETE CASCADE,
  entry_id    BIGINT REFERENCES cs_daily_log_entries(id) ON DELETE CASCADE,
  body        VARCHAR(2000) NOT NULL,
  created_by  INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cs_dlc_log   ON cs_daily_log_comments(log_id);
CREATE INDEX idx_cs_dlc_entry ON cs_daily_log_comments(entry_id) WHERE entry_id IS NOT NULL;

-- ============================================================================
-- ÖZET VIEW'LARI
-- ============================================================================

-- Gün başlığı toplamları — takvim hücresi ve rapor başlığı bunu okur.
CREATE VIEW cs_v_daily_log_totals AS
SELECT l.id                       AS log_id,
       l.company_id,
       l.project_id,
       l.log_date,
       l.status,
       l.work_state,
       COALESCE(SUM(e.headcount) FILTER (WHERE e.kind = 'subcontractor'), 0) AS sub_headcount,
       COALESCE(SUM(e.hours)     FILTER (WHERE e.kind = 'subcontractor'), 0) AS sub_hours,
       -- Kendi personelinde satır başına 1 kişi sayılır (headcount taşımaz)
       COUNT(*)                  FILTER (WHERE e.kind = 'personnel')         AS own_headcount,
       COALESCE(SUM(e.hours)     FILTER (WHERE e.kind = 'personnel'), 0)     AS own_hours,
       COALESCE(SUM(e.hours)     FILTER (WHERE e.kind = 'equipment'), 0)     AS equip_hours,
       COALESCE(SUM(e.idle_hours) FILTER (WHERE e.kind = 'equipment'), 0)    AS equip_idle_hours,
       COUNT(*) FILTER (WHERE e.kind = 'accident')                           AS accident_count,
       COUNT(*) FILTER (WHERE e.kind = 'accident' AND e.severity <> 'near_miss') AS real_accident_count,
       COALESCE(SUM(e.lost_days) FILTER (WHERE e.kind = 'accident'), 0)      AS lost_days,
       COUNT(*) FILTER (WHERE e.kind = 'production')                         AS production_count,
       COUNT(*) FILTER (WHERE e.kind = 'delivery')                           AS delivery_count,
       COUNT(e.id)                                                          AS entry_count,
       (SELECT count(*) FROM cs_daily_log_files f WHERE f.log_id = l.id)     AS file_count
  FROM cs_daily_logs l
  LEFT JOIN cs_daily_log_entries e ON e.log_id = l.id
 GROUP BY l.id, l.company_id, l.project_id, l.log_date, l.status, l.work_state;

-- İş gücü histogramı: proje × gün → kendi / taşeron kişi ve saat.
-- Şantiye finansında "adam-gün" eğrisi buradan çıkar.
CREATE VIEW cs_v_daily_manpower AS
SELECT company_id,
       project_id,
       log_date,
       work_state,
       own_headcount,
       own_hours,
       sub_headcount,
       sub_hours,
       (own_headcount + sub_headcount) AS total_headcount,
       (own_hours + sub_hours)         AS total_hours
  FROM cs_v_daily_log_totals;

-- İmalat gerçekleşmesi: keşif satırı bazında günlükten toplanan miktar.
-- Hakedişten BAĞIMSIZ ölçüm — Faz 4 (adam×saat/verimlilik) ve keşif ekranının
-- "gerçekleşen miktar" kolonu bunu okuyacak.
CREATE VIEW cs_v_production_actuals AS
SELECT e.company_id,
       l.project_id,
       e.boq_line_id,
       e.unit,
       SUM(e.qty)      AS produced_qty,
       MIN(l.log_date) AS first_date,
       MAX(l.log_date) AS last_date,
       COUNT(*)        AS entry_count
  FROM cs_daily_log_entries e
  JOIN cs_daily_logs l ON l.id = e.log_id
 WHERE e.kind = 'production' AND e.boq_line_id IS NOT NULL
 GROUP BY e.company_id, l.project_id, e.boq_line_id, e.unit;

-- Malzeme tüketimi: mekân × malzeme bazında toplam. Fire analizinin girdisi.
CREATE VIEW cs_v_material_consumption AS
SELECT e.company_id,
       l.project_id,
       e.material_id,
       e.location_id,
       e.unit,
       SUM(e.qty) AS consumed_qty,
       COUNT(*)   AS entry_count
  FROM cs_daily_log_entries e
  JOIN cs_daily_logs l ON l.id = e.log_id
 WHERE e.kind = 'material_used' AND e.material_id IS NOT NULL
 GROUP BY e.company_id, l.project_id, e.material_id, e.location_id, e.unit;

COMMENT ON TABLE cs_daily_logs IS
  'Şantiye günlüğü gün başlığı. status=locked ise satırlar değiştirilemez (ıslak imza karşılığı).';
COMMENT ON TABLE cs_daily_log_entries IS
  'Çok tipli günlük kayıt satırı; kind alanına göre farklı alanlar dolar.';
COMMENT ON VIEW cs_v_production_actuals IS
  'Günlük imalat kayıtlarından keşif satırı bazında gerçekleşen miktar (hakedişten bağımsız).';
