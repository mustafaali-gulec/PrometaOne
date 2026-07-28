-- ============================================================================
-- 006_physical_progress.sql — FAZ 2: FİZİKSEL İLERLEME TAKİBİ (Güncel Durum)
--
-- Bugüne kadar proje ilerlemesini SADECE hakedişten türetiyorduk. Bu, sahada
-- iki büyük kör noktaya yol açıyor:
--   1) Taşeron sözleşmesi/hakedişi olmayan iş (kendi ekibi, emanet usulü) hiç
--      görünmüyor — ilerleme %0 raporlanıyor.
--   2) İlerleme mekâna göre kırılamıyor: "A Blok kaba inşaat nerede?" sorusuna
--      hakediş tablosu cevap veremiyor.
--
-- Bu migration, hakedişten BAĞIMSIZ ölçülen ağırlıklı fiziksel ilerlemeyi kurar:
--
--   Şablon (cs_progress_templates)
--     └─ İş Grubu (cs_progress_template_groups)   ağırlık: İ.G. Oran
--          └─ İş     (cs_progress_template_items) ağırlık: İ. Oran
--
--   Takip (cs_trackings)  — şablonun bir projeye uygulanmış örneği
--     ├─ project_weight_pct : takibin proje toplamına etkisi
--     └─ Kapsam lokasyonları (cs_tracking_locations)
--          └─ Durum satırı (cs_tracking_items)  lokasyon × iş → durum
--
-- Rollup (view'lar):
--   lokasyon% = Σ(iş% × iş.ağırlık × grup.ağırlık) / Σ(iş.ağırlık × grup.ağırlık)
--   takip%    = Σ(lokasyon% × lokasyon.ağırlık) / Σ(lokasyon.ağırlık)
--   proje%    = Σ(takip% × takip.project_weight_pct) / 100
--
-- Son satırda 100'e değil sabit 100'e bölünür: proje ağırlıkları toplamı 100'ün
-- altındaysa kalan pay ölçülmemiş iş demektir ve %0 olarak sayılır. weight_sum
-- alanı ile arayüz eksik ağırlığı kullanıcıya uyarı olarak gösterir.
-- ============================================================================

-- Şablonun uygulanma seviyesi. Takip oluşturulurken kapsam lokasyonları bu
-- tipteki lokasyonlardan seçilir ('general' → projenin kökü tek lokasyon sayılır).
CREATE TYPE cs_track_scope AS ENUM ('general', 'block', 'floor', 'unit');

CREATE TYPE cs_tracking_status AS ENUM ('draft', 'active', 'completed', 'cancelled');

-- İş kaleminin saha durumu. Yüzde karşılıkları şablonda ayarlanabilir
-- (Imperium varsayılanı: Devam %50 / Eksikleri Var %75 / Tamamlandı %100).
CREATE TYPE cs_item_state AS ENUM ('not_started', 'in_progress', 'has_defects', 'completed');

-- ============================================================================
-- ŞABLONLAR (şirket katmanı — projeler arası yeniden kullanılır)
-- ============================================================================
CREATE TABLE cs_progress_templates (
  id            BIGSERIAL PRIMARY KEY,
  company_id    INT NOT NULL,
  code          VARCHAR(40)  NOT NULL,
  name          VARCHAR(300) NOT NULL,
  scope         cs_track_scope NOT NULL DEFAULT 'block',
  description   TEXT,
  -- Durum → yüzde eşlemesi (not_started her zaman 0, completed her zaman 100)
  pct_in_progress NUMERIC(5, 2) NOT NULL DEFAULT 50 CHECK (pct_in_progress BETWEEN 0 AND 100),
  pct_has_defects NUMERIC(5, 2) NOT NULL DEFAULT 75 CHECK (pct_has_defects BETWEEN 0 AND 100),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, code)
);
CREATE INDEX idx_cs_ptpl_company_active ON cs_progress_templates(company_id, active);
CREATE TRIGGER cs_progress_templates_updated_at
  BEFORE UPDATE ON cs_progress_templates
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

CREATE TABLE cs_progress_template_groups (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INT NOT NULL,
  template_id BIGINT NOT NULL REFERENCES cs_progress_templates(id) ON DELETE CASCADE,
  code        VARCHAR(40)  NOT NULL,
  name        VARCHAR(300) NOT NULL,           -- "Temel", "Kaba İnşaat", "Çatı"
  weight_pct  NUMERIC(9, 4) NOT NULL DEFAULT 0 CHECK (weight_pct >= 0),  -- İ.G. Oran
  sort_order  INT NOT NULL DEFAULT 0,
  UNIQUE (template_id, code)
);
CREATE INDEX idx_cs_ptg_template ON cs_progress_template_groups(template_id, sort_order);

CREATE TABLE cs_progress_template_items (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INT NOT NULL,
  group_id    BIGINT NOT NULL REFERENCES cs_progress_template_groups(id) ON DELETE CASCADE,
  code        VARCHAR(40)  NOT NULL,
  name        VARCHAR(300) NOT NULL,           -- "Temel Kazısı", "2.Kat Kalıp"
  weight_pct  NUMERIC(9, 4) NOT NULL DEFAULT 0 CHECK (weight_pct >= 0),  -- İ. Oran
  sort_order  INT NOT NULL DEFAULT 0,
  -- Opsiyonel: bu işin keşifteki karşılığı. Doluysa fiziksel ilerleme ile
  -- pursantaj/hakediş yan yana raporlanabilir (Faz 7 sapma analizi).
  poz_id      BIGINT REFERENCES cs_poz_catalog(id) ON DELETE SET NULL,
  UNIQUE (group_id, code)
);
CREATE INDEX idx_cs_pti_group ON cs_progress_template_items(group_id, sort_order);

-- ============================================================================
-- TAKİPLER (proje katmanı — şablonun bir projeye uygulanması)
-- ============================================================================
CREATE TABLE cs_trackings (
  id                 BIGSERIAL PRIMARY KEY,
  company_id         INT NOT NULL,
  project_id         BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  template_id        BIGINT NOT NULL REFERENCES cs_progress_templates(id) ON DELETE RESTRICT,
  code               VARCHAR(40)  NOT NULL,
  name               VARCHAR(300) NOT NULL,
  -- Takibin proje toplam ilerlemesine etkisi (Imperium: "Projeye Etki Oranı")
  project_weight_pct NUMERIC(9, 4) NOT NULL DEFAULT 0 CHECK (project_weight_pct BETWEEN 0 AND 100),
  planned_start      DATE,
  planned_end        DATE,
  status             cs_tracking_status NOT NULL DEFAULT 'draft',
  assigned_user_id   INT,                       -- soft ref → users
  visible_all        BOOLEAN NOT NULL DEFAULT TRUE,
  note               TEXT,
  created_by         INT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, code)
);
CREATE INDEX idx_cs_trk_project ON cs_trackings(project_id, status);
CREATE TRIGGER cs_trackings_updated_at
  BEFORE UPDATE ON cs_trackings
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- Takibin kapsadığı lokasyonlar. Imperium'daki "A BLOK / B BLOK" sekmeleri.
CREATE TABLE cs_tracking_locations (
  id           BIGSERIAL PRIMARY KEY,
  company_id   INT NOT NULL,
  tracking_id  BIGINT NOT NULL REFERENCES cs_trackings(id) ON DELETE CASCADE,
  location_id  BIGINT NOT NULL REFERENCES cs_locations(id) ON DELETE CASCADE,
  -- Lokasyonun takip içindeki ağırlığı. Varsayılan 1 = eşit ağırlık; farklı
  -- büyüklükteki bloklar için m² oranı girilebilir.
  weight_pct   NUMERIC(9, 4) NOT NULL DEFAULT 1 CHECK (weight_pct >= 0),
  sort_order   INT NOT NULL DEFAULT 0,
  UNIQUE (tracking_id, location_id)
);
CREATE INDEX idx_cs_trkloc_tracking ON cs_tracking_locations(tracking_id, sort_order);
CREATE INDEX idx_cs_trkloc_location ON cs_tracking_locations(location_id);

-- Asıl veri: lokasyon × iş kalemi → saha durumu.
-- Takip oluşturulurken şablondaki her iş, kapsamdaki her lokasyon için
-- 'not_started' olarak materyalize edilir (böylece saha ekranı tam tabloyu görür).
CREATE TABLE cs_tracking_items (
  id                   BIGSERIAL PRIMARY KEY,
  company_id           INT NOT NULL,
  tracking_id          BIGINT NOT NULL REFERENCES cs_trackings(id) ON DELETE CASCADE,
  tracking_location_id BIGINT NOT NULL REFERENCES cs_tracking_locations(id) ON DELETE CASCADE,
  template_item_id     BIGINT NOT NULL REFERENCES cs_progress_template_items(id) ON DELETE CASCADE,
  state                cs_item_state NOT NULL DEFAULT 'not_started',
  -- Durumun yüzde karşılığını ezmek için (kısmi imalat: "%30 döküldü")
  override_pct         NUMERIC(5, 2) CHECK (override_pct IS NULL OR override_pct BETWEEN 0 AND 100),
  inspected_by         INT,                     -- soft ref → users (Denetleyen)
  inspected_at         DATE,
  note                 VARCHAR(1000),
  updated_by           INT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tracking_location_id, template_item_id)
);
CREATE INDEX idx_cs_trkitem_tracking ON cs_tracking_items(tracking_id);
CREATE INDEX idx_cs_trkitem_state    ON cs_tracking_items(tracking_id, state);
CREATE TRIGGER cs_tracking_items_updated_at
  BEFORE UPDATE ON cs_tracking_items
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- İş kaleminin durum geçmişi — "kim, ne zaman, neyi %100'e çekti" denetim izi.
CREATE TABLE cs_tracking_item_history (
  id                BIGSERIAL PRIMARY KEY,
  company_id        INT NOT NULL,
  tracking_item_id  BIGINT NOT NULL REFERENCES cs_tracking_items(id) ON DELETE CASCADE,
  from_state        cs_item_state,
  to_state          cs_item_state NOT NULL,
  from_pct          NUMERIC(5, 2),
  to_pct            NUMERIC(5, 2) NOT NULL,
  changed_by        INT,
  changed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note              VARCHAR(1000)
);
CREATE INDEX idx_cs_trkhist_item ON cs_tracking_item_history(tracking_item_id, changed_at DESC);

-- ============================================================================
-- ROLLUP VIEW'LARI
-- ============================================================================

-- Bir tracking_item'ın efektif yüzdesi: override varsa o, yoksa şablonun
-- durum→yüzde eşlemesi.
CREATE VIEW cs_v_tracking_item_pct AS
SELECT ti.id                          AS tracking_item_id,
       ti.company_id,
       ti.tracking_id,
       ti.tracking_location_id,
       ti.template_item_id,
       ti.state,
       tl.location_id,
       tpi.group_id,
       tpi.name                       AS item_name,
       tpi.weight_pct                 AS item_weight,
       tpg.name                       AS group_name,
       tpg.weight_pct                 AS group_weight,
       COALESCE(
         ti.override_pct,
         CASE ti.state
           WHEN 'not_started' THEN 0
           WHEN 'in_progress' THEN tpl.pct_in_progress
           WHEN 'has_defects' THEN tpl.pct_has_defects
           WHEN 'completed'   THEN 100
         END
       )                              AS effective_pct,
       -- Ağırlıklı katkı payı: iş ağırlığı × grup ağırlığı
       (tpi.weight_pct * tpg.weight_pct) AS combined_weight
  FROM cs_tracking_items ti
  JOIN cs_tracking_locations       tl  ON tl.id  = ti.tracking_location_id
  JOIN cs_progress_template_items  tpi ON tpi.id = ti.template_item_id
  JOIN cs_progress_template_groups tpg ON tpg.id = tpi.group_id
  JOIN cs_trackings                trk ON trk.id = ti.tracking_id
  JOIN cs_progress_templates       tpl ON tpl.id = trk.template_id;

-- Lokasyon bazında ilerleme (Imperium'un blok sekmesi başındaki % çubuğu)
CREATE VIEW cs_v_tracking_location_progress AS
SELECT v.company_id,
       v.tracking_id,
       v.tracking_location_id,
       v.location_id,
       SUM(v.effective_pct * v.combined_weight)
         / NULLIF(SUM(v.combined_weight), 0)          AS progress_pct,
       COUNT(*)                                        AS item_count,
       COUNT(*) FILTER (WHERE v.state = 'completed')   AS completed_count,
       COUNT(*) FILTER (WHERE v.state = 'has_defects') AS defect_count,
       COUNT(*) FILTER (WHERE v.state = 'in_progress') AS in_progress_count
  FROM cs_v_tracking_item_pct v
 GROUP BY v.company_id, v.tracking_id, v.tracking_location_id, v.location_id;

-- Takip bazında ilerleme (lokasyon ağırlıklarıyla)
CREATE VIEW cs_v_tracking_progress AS
SELECT t.company_id,
       t.id           AS tracking_id,
       t.project_id,
       t.project_weight_pct,
       COALESCE(
         SUM(lp.progress_pct * tl.weight_pct) / NULLIF(SUM(tl.weight_pct), 0),
         0
       )              AS progress_pct,
       COUNT(tl.id)   AS location_count
  FROM cs_trackings t
  LEFT JOIN cs_tracking_locations tl ON tl.tracking_id = t.id
  LEFT JOIN cs_v_tracking_location_progress lp ON lp.tracking_location_id = tl.id
 GROUP BY t.company_id, t.id, t.project_id, t.project_weight_pct;

-- Proje fiziksel ilerlemesi. İptal edilen takipler sayılmaz.
-- Payda sabit 100: atanmamış ağırlık ölçülmemiş iş = %0 katkı.
CREATE VIEW cs_v_project_physical_progress AS
SELECT p.company_id,
       p.id                                                     AS project_id,
       COALESCE(SUM(tp.progress_pct * tp.project_weight_pct) / 100, 0) AS progress_pct,
       COALESCE(SUM(tp.project_weight_pct), 0)                  AS weight_sum,
       COUNT(tp.tracking_id)                                    AS tracking_count
  FROM cs_projects p
  LEFT JOIN cs_v_tracking_progress tp
         ON tp.project_id = p.id
        AND EXISTS (SELECT 1 FROM cs_trackings t2
                     WHERE t2.id = tp.tracking_id AND t2.status <> 'cancelled')
 GROUP BY p.company_id, p.id;

COMMENT ON VIEW cs_v_project_physical_progress IS
  'Projenin ağırlıklı fiziksel ilerlemesi. weight_sum < 100 ise ölçülmeyen iş payı vardır.';
COMMENT ON COLUMN cs_tracking_items.override_pct IS
  'Durumun yüzde karşılığını ezer (kısmi imalat). NULL ise şablonun state→pct eşlemesi kullanılır.';
