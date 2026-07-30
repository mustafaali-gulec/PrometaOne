-- ============================================================================
-- 016_collaboration.sql — FAZ 11: İŞBİRLİĞİ
-- (duyuru panosu + proje ekibi + bilgilendirme listesi + okunma bilgisi + galeri)
--
-- Imperium'un "Şantiye Sosyal Medyası": proje duvarına gönderi, sabitlenen
-- duyuru, gönderiyi kimlerin okuduğu, proje ekibi ve fotoğraf galerisi.
--
-- İSİM KOPYALAMA KARARI: cs_ref_users projeksiyon tablosu BOŞ olabilir (senkron
-- monolitten gelir). Ekran adları bu yüzden yazma ANINDA kopyalanır:
-- member_name ekleyen kişinin girdiği ad, author_name/user_name JWT'deki
-- username. Referans tablosu sonradan dolsa da tarihî kayıtların kim tarafından
-- atıldığı değişmez (Faz 6'daki "madde metni cevaba kopyalanır" gerekçesi).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Proje ekibi. Okunma oranının PAYDASI buradan gelir (açık bilgilendirme
-- listesi olmayan gönderide "ekipten kaçı okudu"). Soft-deactivate: ayrılan
-- üyenin geçmiş okuma/yorum izi silinmez.
-- ---------------------------------------------------------------------------
CREATE TABLE cs_project_members (
  id           BIGSERIAL PRIMARY KEY,
  company_id   INT    NOT NULL,
  project_id   BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  user_id      INT    NOT NULL,
  member_name  VARCHAR(200) NOT NULL,
  member_role  VARCHAR(30) NOT NULL DEFAULT 'other',
  title        VARCHAR(120),
  note         TEXT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  added_by     INT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cs_pm_role_chk CHECK (member_role IN
    ('manager', 'engineer', 'site_chief', 'foreman', 'accountant', 'viewer', 'other')),
  CONSTRAINT cs_pm_user_uq UNIQUE (project_id, user_id)
);

CREATE INDEX idx_cs_pm_project ON cs_project_members(company_id, project_id, active);

CREATE TRIGGER cs_project_members_updated_at
  BEFORE UPDATE ON cs_project_members
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

COMMENT ON TABLE cs_project_members IS
  'Proje ekibi. Okunma oranının paydası; member_name yazma anında kopyalanır (ref tablosu boş olabilir).';

-- ---------------------------------------------------------------------------
-- Duyuru panosu / proje duvarı. Silme SOFT (active=false): okunmuş duyuruyu
-- yok etmek "kimse görmedi" iddiasına kapı açar. Düzenleme edited_at izi
-- bırakır — okuyanlar gönderinin sonradan değiştiğini görebilmeli.
-- ---------------------------------------------------------------------------
CREATE TABLE cs_posts (
  id           BIGSERIAL PRIMARY KEY,
  company_id   INT    NOT NULL,
  project_id   BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  title        VARCHAR(300),
  body         TEXT NOT NULL,
  pinned       BOOLEAN NOT NULL DEFAULT FALSE,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by   INT,
  author_name  VARCHAR(200) NOT NULL DEFAULT '',
  edited_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cs_posts_project ON cs_posts(company_id, project_id, active, pinned);

CREATE TRIGGER cs_posts_updated_at
  BEFORE UPDATE ON cs_posts
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

COMMENT ON TABLE cs_posts IS
  'Duyuru panosu / proje duvarı. Soft delete + edited_at izi; yalnız yazar veya admin düzenler/siler.';

-- Bilgilendirme listesi: gönderi belirli kişilere hedeflenebilir.
-- LİSTE BOŞSA hedef kitle = aktif proje ekibi (görünümdeki payda kuralı).
CREATE TABLE cs_post_recipients (
  id        BIGSERIAL PRIMARY KEY,
  post_id   BIGINT NOT NULL REFERENCES cs_posts(id) ON DELETE CASCADE,
  user_id   INT NOT NULL,
  user_name VARCHAR(200) NOT NULL DEFAULT '',
  CONSTRAINT cs_pr_uq UNIQUE (post_id, user_id)
);

-- Okunma bilgisi: İLK okuma anı. Tekrar okuma ÜZERİNE YAZMAZ — "ne zaman
-- haberdar oldu" sorusunun cevabı ilk andır; güncellemek kanıtı bozar.
CREATE TABLE cs_post_reads (
  id        BIGSERIAL PRIMARY KEY,
  post_id   BIGINT NOT NULL REFERENCES cs_posts(id) ON DELETE CASCADE,
  user_id   INT NOT NULL,
  user_name VARCHAR(200) NOT NULL DEFAULT '',
  read_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cs_prd_uq UNIQUE (post_id, user_id)
);

CREATE INDEX idx_cs_post_reads_post ON cs_post_reads(post_id);

-- Yorumlar: silme/düzenleme YOK — duvar yazışması denetim izidir (kilitli
-- günde yorumun serbest olması gibi: iz dondurulur, yazışma değil).
CREATE TABLE cs_post_comments (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INT    NOT NULL,
  post_id     BIGINT NOT NULL REFERENCES cs_posts(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_by  INT,
  author_name VARCHAR(200) NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cs_post_comments_post ON cs_post_comments(post_id);

-- ---------------------------------------------------------------------------
-- Galeri. Fotoğraf mekân ağacına bağlanabilir (location_id) — "hangi blokta/
-- dairede çekildi" sorusu galeriyi rapora bağlar. Yük cs_quality_files
-- kalıbıyla: URL YA DA gömülü içerik (BYTEA), en az biri şart.
-- ---------------------------------------------------------------------------
CREATE TABLE cs_project_photos (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INT    NOT NULL,
  project_id  BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  location_id BIGINT REFERENCES cs_locations(id) ON DELETE SET NULL,
  title       VARCHAR(300),
  taken_at    DATE,
  file_url    VARCHAR(1000),
  content     BYTEA,
  mime_type   VARCHAR(100),
  size_bytes  INT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  INT,
  author_name VARCHAR(200) NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cs_pp_has_payload CHECK (file_url IS NOT NULL OR content IS NOT NULL)
);

CREATE INDEX idx_cs_pp_project ON cs_project_photos(company_id, project_id, active);

COMMENT ON TABLE cs_project_photos IS
  'Proje galerisi. location_id ile mekân ağacına bağlanabilir; yük URL ya da BYTEA.';

-- ---------------------------------------------------------------------------
-- OKUNMA İSTATİSTİĞİ. Payda: açık bilgilendirme listesi varsa o liste, yoksa
-- AKTİF proje ekibi. target_read_count yalnız hedef kitledeki okumaları sayar
-- ("bilgilendirilecek N kişiden M'i okudu"); total_read_count herkesi.
-- Payda 0 (ekipsiz proje + listesiz gönderi) → oran arayüzde NULL basılır,
-- 0 değil — "kimse okumadı" ile "hedef kitle tanımsız" aynı şey değildir.
-- ---------------------------------------------------------------------------
CREATE VIEW cs_v_post_read_stats AS
SELECT p.id AS post_id,
       p.company_id,
       p.project_id,
       CASE WHEN EXISTS (SELECT 1 FROM cs_post_recipients r WHERE r.post_id = p.id)
            THEN (SELECT COUNT(*) FROM cs_post_recipients r WHERE r.post_id = p.id)
            ELSE (SELECT COUNT(*) FROM cs_project_members m
                   WHERE m.project_id = p.project_id AND m.active)
       END AS recipient_count,
       (SELECT COUNT(*) FROM cs_post_reads rd WHERE rd.post_id = p.id) AS total_read_count,
       CASE WHEN EXISTS (SELECT 1 FROM cs_post_recipients r WHERE r.post_id = p.id)
            THEN (SELECT COUNT(*) FROM cs_post_reads rd
                    JOIN cs_post_recipients r
                      ON r.post_id = rd.post_id AND r.user_id = rd.user_id
                   WHERE rd.post_id = p.id)
            ELSE (SELECT COUNT(*) FROM cs_post_reads rd
                    JOIN cs_project_members m
                      ON m.project_id = p.project_id AND m.user_id = rd.user_id AND m.active
                   WHERE rd.post_id = p.id)
       END AS target_read_count,
       (SELECT COUNT(*) FROM cs_post_comments cm WHERE cm.post_id = p.id) AS comment_count
  FROM cs_posts p;

COMMENT ON VIEW cs_v_post_read_stats IS
  'Gönderi okunma istatistiği. Payda: açık alıcı listesi ya da aktif ekip; payda 0 → oran NULL.';
