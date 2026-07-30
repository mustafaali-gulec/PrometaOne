-- ============================================================================
-- 005_locations.sql — FAZ 1: MEKÂN KIRILIMI (Proje > Blok > Kat > Bağımsız Bölüm)
--
-- Şantiye yönetiminde "nerede?" sorusu, "ne kadar?" sorusu kadar temeldir. Bu
-- migration mekânı birinci sınıf bir boyut haline getirir: hiyerarşik lokasyon
-- ağacı (cs_locations) + bu ağaca bağlanan tüm operasyonel kayıtlar.
--
-- Mevcut cs_sites düz (tek seviye) tablosu KALDIRILMAZ; geriye dönük uyum için
-- kalır ve her cs_sites satırı için kind='site' bir kök lokasyon üretilir.
--
-- Ağaç modeli: parent_id (adjacency list) + materialized `path` ("A Blok > 2 > 18")
-- ve `depth`. path/depth trigger ile türetilir — istemci göndermez, tutarsızlaşamaz.
-- ============================================================================

-- Lokasyon tipi. 'zone' = blok dışı saha bölgesi (şev, yol, altyapı hattı, kule vb.)
CREATE TYPE cs_location_kind AS ENUM ('site', 'block', 'floor', 'unit', 'zone');

CREATE TABLE cs_locations (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INT    NOT NULL,
  project_id  BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  parent_id   BIGINT REFERENCES cs_locations(id) ON DELETE CASCADE,
  kind        cs_location_kind NOT NULL,
  code        VARCHAR(40)  NOT NULL,          -- "A", "2", "18"
  name        VARCHAR(200) NOT NULL,          -- "A Blok", "2. Kat", "Daire 18"
  sort_order  INT NOT NULL DEFAULT 0,

  -- Trigger ile türetilir (aşağıdaki cs_locations_refresh_path)
  path        VARCHAR(1000) NOT NULL DEFAULT '',
  depth       SMALLINT      NOT NULL DEFAULT 0,

  -- Bağımsız bölüm (kind='unit') nitelikleri — konut/ticari projeler için
  unit_type   VARCHAR(40),                    -- "2+1", "dükkan", "ofis"
  gross_area  NUMERIC(12, 2) CHECK (gross_area  IS NULL OR gross_area  >= 0),
  net_area    NUMERIC(12, 2) CHECK (net_area    IS NULL OR net_area    >= 0),
  land_share  NUMERIC(12, 4) CHECK (land_share  IS NULL OR land_share  >= 0), -- arsa payı
  facade      VARCHAR(40),                    -- cephe (kuzey/güney/köşe...)

  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Aynı ebeveyn altında kod tekrar etmez. parent_id NULL olan kökler için
  -- UNIQUE NULL'ları ayrı kabul eder; kökler idx_cs_loc_root_code ile korunur.
  UNIQUE (company_id, project_id, parent_id, code),

  -- Kendi kendinin ebeveyni olamaz
  CONSTRAINT cs_locations_no_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE UNIQUE INDEX idx_cs_loc_root_code
  ON cs_locations(company_id, project_id, code)
  WHERE parent_id IS NULL;

CREATE INDEX idx_cs_loc_project      ON cs_locations(project_id, kind);
CREATE INDEX idx_cs_loc_parent       ON cs_locations(parent_id);
CREATE INDEX idx_cs_loc_project_path ON cs_locations(project_id, path);

CREATE TRIGGER cs_locations_updated_at
  BEFORE UPDATE ON cs_locations
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- ---------------------------------------------------------------------------
-- path / depth türetimi
--
-- INSERT ve (parent_id | name değiştiyse) UPDATE'te kendi path'ini hesaplar,
-- ardından alt ağacı recursive olarak yeniden yazar. Döngü koruması: ebeveyn
-- zinciri kendine dönüyorsa hata verir.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cs_locations_refresh_path() RETURNS trigger AS $$
DECLARE
  parent_path  VARCHAR(1000);
  parent_depth SMALLINT;
  parent_proj  BIGINT;
  guard        INT;
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.path  := NEW.name;
    NEW.depth := 0;
  ELSE
    SELECT path, depth, project_id INTO parent_path, parent_depth, parent_proj
      FROM cs_locations WHERE id = NEW.parent_id;

    IF parent_path IS NULL THEN
      RAISE EXCEPTION 'cs_locations: parent_id % bulunamadi', NEW.parent_id;
    END IF;
    IF parent_proj <> NEW.project_id THEN
      RAISE EXCEPTION 'cs_locations: ebeveyn farkli projede (parent proje %, kayit proje %)',
        parent_proj, NEW.project_id;
    END IF;

    -- Döngü koruması: NEW.id ebeveyn zincirinde görünüyorsa reddet
    IF TG_OP = 'UPDATE' THEN
      guard := NEW.parent_id;
      FOR i IN 1..64 LOOP
        EXIT WHEN guard IS NULL;
        IF guard = NEW.id THEN
          RAISE EXCEPTION 'cs_locations: dongusel ebeveyn zinciri (id %)', NEW.id;
        END IF;
        SELECT parent_id INTO guard FROM cs_locations WHERE id = guard;
      END LOOP;
    END IF;

    NEW.path  := parent_path || ' > ' || NEW.name;
    NEW.depth := parent_depth + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cs_locations_path_biu
  BEFORE INSERT OR UPDATE OF parent_id, name, project_id ON cs_locations
  FOR EACH ROW EXECUTE FUNCTION cs_locations_refresh_path();

-- Ebeveynin adı/yeri değişince alt ağacın path'i bayatlar; AFTER trigger ile
-- çocukları dokundurup (no-op UPDATE) BEFORE trigger'ı zincirleyerek tazeleriz.
--
-- DİKKAT: tetikleyici sütun listesi (`AFTER UPDATE OF path`) KULLANILMAZ.
-- Postgres'te `UPDATE OF <sütun>` yalnız o sütun SET listesinde ANILDIĞINDA
-- ateşlenir — path'i BEFORE trigger yazdığı için SET listesinde hiç görünmez ve
-- sütun listeli tetikleyici hiç çalışmaz. Bu yüzden tüm UPDATE'lerde ateşlenip
-- gövdede path değişimi kontrol edilir.
CREATE OR REPLACE FUNCTION cs_locations_cascade_path() RETURNS trigger AS $$
BEGIN
  IF NEW.path IS DISTINCT FROM OLD.path THEN
    -- name = name: BEFORE trigger'ı zincirler, çocuk kendi path'ini yeniden
    -- hesaplar; o da kendi çocuklarını tetikler (ağacın derinliğince özyineleme).
    UPDATE cs_locations SET name = name WHERE parent_id = NEW.id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cs_locations_path_aiu
  AFTER UPDATE ON cs_locations
  FOR EACH ROW EXECUTE FUNCTION cs_locations_cascade_path();

-- ============================================================================
-- PROJE KARTI ZENGİNLEŞTİRME
-- Imperium proje panelindeki künye alanları: tip, ada/parsel, bağımsız bölüm
-- sayısı, toplam inşaat alanı, şehir/ülke, takip tipi.
-- ============================================================================
CREATE TYPE cs_project_kind AS ENUM (
  'konut', 'ticari', 'karma', 'sanayi', 'altyapi', 'ustyapi', 'enerji', 'diger'
);

-- Projenin fiziksel ilerlemesi nasıl ölçülüyor?
--   'hakedis'  → yalnız hakediş/pursantaj üzerinden (mevcut davranış)
--   'guncel_durum' → fiziksel takip (Faz 2) üzerinden
--   'karma'    → ikisi birlikte raporlanır
CREATE TYPE cs_tracking_type AS ENUM ('hakedis', 'guncel_durum', 'karma');

ALTER TABLE cs_projects
  ADD COLUMN project_kind  cs_project_kind  NOT NULL DEFAULT 'diger',
  ADD COLUMN tracking_type cs_tracking_type NOT NULL DEFAULT 'hakedis',
  ADD COLUMN city          VARCHAR(80),
  ADD COLUMN country       VARCHAR(80),
  ADD COLUMN ada           VARCHAR(40),
  ADD COLUMN parsel        VARCHAR(40),
  ADD COLUMN unit_count    INT            CHECK (unit_count IS NULL OR unit_count >= 0),
  ADD COLUMN total_area    NUMERIC(14, 2) CHECK (total_area IS NULL OR total_area >= 0),
  ADD COLUMN actual_end    DATE;

-- ============================================================================
-- LOKASYON BOYUTUNUN OPERASYONEL KAYITLARA BAĞLANMASI
--
-- Hepsi NULLABLE + ON DELETE SET NULL: lokasyon silinse kayıt kaybolmaz,
-- yalnız mekân etiketi düşer. Mevcut satırlar NULL kalır (geriye dönük uyum).
-- ============================================================================
ALTER TABLE cs_boq_lines        ADD COLUMN location_id BIGINT REFERENCES cs_locations(id) ON DELETE SET NULL;
ALTER TABLE cs_expenses         ADD COLUMN location_id BIGINT REFERENCES cs_locations(id) ON DELETE SET NULL;
ALTER TABLE cs_timesheets       ADD COLUMN location_id BIGINT REFERENCES cs_locations(id) ON DELETE SET NULL;
ALTER TABLE cs_machine_logs     ADD COLUMN location_id BIGINT REFERENCES cs_locations(id) ON DELETE SET NULL;
ALTER TABLE cs_stock_movements  ADD COLUMN location_id BIGINT REFERENCES cs_locations(id) ON DELETE SET NULL;
ALTER TABLE cs_measurement_book ADD COLUMN location_id BIGINT REFERENCES cs_locations(id) ON DELETE SET NULL;
ALTER TABLE cs_material_requests ADD COLUMN location_id BIGINT REFERENCES cs_locations(id) ON DELETE SET NULL;
ALTER TABLE cs_attachments      ADD COLUMN location_id BIGINT REFERENCES cs_locations(id) ON DELETE SET NULL;

CREATE INDEX idx_cs_boq_lines_loc   ON cs_boq_lines(location_id)        WHERE location_id IS NOT NULL;
CREATE INDEX idx_cs_expenses_loc    ON cs_expenses(location_id)         WHERE location_id IS NOT NULL;
CREATE INDEX idx_cs_ts_loc          ON cs_timesheets(location_id)       WHERE location_id IS NOT NULL;
CREATE INDEX idx_cs_mlog_loc        ON cs_machine_logs(location_id)     WHERE location_id IS NOT NULL;
CREATE INDEX idx_cs_smv_loc         ON cs_stock_movements(location_id)  WHERE location_id IS NOT NULL;
CREATE INDEX idx_cs_mb_loc          ON cs_measurement_book(location_id) WHERE location_id IS NOT NULL;
CREATE INDEX idx_cs_mreq_loc        ON cs_material_requests(location_id) WHERE location_id IS NOT NULL;
CREATE INDEX idx_cs_att_loc         ON cs_attachments(location_id)      WHERE location_id IS NOT NULL;

-- ============================================================================
-- GEÇİŞ: mevcut cs_sites satırları → kök lokasyon (kind='site')
--
-- cs_sites.code lokasyon koduna, name path'in köküne gider. Proje başına kod
-- çakışması olursa (aynı projede iki site aynı kodda olamaz — cs_sites UNIQUE
-- zaten engelliyor) sorun çıkmaz.
-- ============================================================================
INSERT INTO cs_locations (company_id, project_id, parent_id, kind, code, name, sort_order, active)
SELECT s.company_id, s.project_id, NULL, 'site', s.code, s.name, 0, s.active
  FROM cs_sites s
 WHERE NOT EXISTS (
        SELECT 1 FROM cs_locations l
         WHERE l.project_id = s.project_id AND l.parent_id IS NULL AND l.code = s.code
       );

COMMENT ON TABLE cs_locations IS
  'Mekân kırılımı ağacı: Proje > Blok/Bölge > Kat > Bağımsız Bölüm. path/depth trigger ile türetilir.';
COMMENT ON COLUMN cs_locations.path IS
  'Materialized tam yol, ör. "A Blok > 2 > Daire 18". Trigger yazar; elle güncellenmez.';
