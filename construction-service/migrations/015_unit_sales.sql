-- ============================================================================
-- 015_unit_sales.sql — FAZ 10: KONUT SATIŞ / GELİR (CRM köprüsü)
--
-- Imperium'un satış tablosu: bağımsız bölüm satış durumu (Satıldı / Rezerve /
-- İş Karşılığı), liste vs satış fiyatı, tahsilat/kalan, müşteri değişiklik
-- isteği. Bağımsız bölümler YENİ TABLO DEĞİL: Faz 1'in mekân ağacındaki
-- kind='unit' lokasyonlarıdır — satış, mekânın bir NİTELİĞİ olarak bağlanır.
--
-- KÖPRÜ KARARI (kullanıcı onaylı): müşteri ilişkisi Satış CRM'de kaynak-of-truth
-- kalır; buradaki cs_unit_sales bir PROJEKSİYONDUR. (company_id, source, ref_no)
-- kısmi UNIQUE kısıtı sayesinde senkron ucu idempotent upsert yapar. Elle giriş
-- (source='manual', ref_no NULL) da desteklenir — her satış CRM fırsatı değildir
-- (iş karşılığı taşerona verilen daire CRM'e hiç düşmez).
--
-- SATIŞSIZ DAİRE = 'available' TÜRETİLİR, SAKLANMAZ: "boş" diye bir satır
-- tutulsaydı ağaçtaki her yeni daire için satır açmak/yaşatmak gerekirdi ve
-- unutulan satır daireyi envanterden kaybederdi.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Liste fiyatı defteri — satıştan BAĞIMSIZ tutulur. Satış anında geçerli liste
-- fiyatı satış kaydına KOPYALANIR (aşağıda list_price): defter sonradan
-- değişince tarihi iskonto ("liste 5M'ydi, 4.6M'ye verildi") oynamamalı.
-- ---------------------------------------------------------------------------
CREATE TABLE cs_unit_prices (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INT    NOT NULL,
  project_id  BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  location_id BIGINT NOT NULL UNIQUE REFERENCES cs_locations(id) ON DELETE CASCADE,
  list_price  NUMERIC(14,2) NOT NULL CHECK (list_price >= 0),
  currency    VARCHAR(3) NOT NULL DEFAULT 'TRY',
  note        TEXT,
  updated_by  INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cs_unit_prices_project ON cs_unit_prices(company_id, project_id);

CREATE TRIGGER cs_unit_prices_updated_at
  BEFORE UPDATE ON cs_unit_prices
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

COMMENT ON TABLE cs_unit_prices IS
  'Bağımsız bölüm liste fiyatı defteri. Satış anındaki değer cs_unit_sales.list_price''a kopyalanır (tarihi iskonto oynamaz).';

-- ---------------------------------------------------------------------------
-- Satış kaydı. Durumlar:
--   reserved  — kapora/rezervasyon (alıcı adı şart)
--   sold      — satıldı (alıcı adı şart)
--   barter    — İş Karşılığı: daire taşerona hakediş yerine verildi (vendor şart)
--   cancelled — iptal (terminal; daire envantere döner, kısmi unique boşalır)
-- ---------------------------------------------------------------------------
CREATE TABLE cs_unit_sales (
  id           BIGSERIAL PRIMARY KEY,
  company_id   INT    NOT NULL,
  project_id   BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  -- RESTRICT: satış kaydı olan daire ağaçtan silinemez — para izi mekânsız kalmaz.
  location_id  BIGINT NOT NULL REFERENCES cs_locations(id) ON DELETE RESTRICT,
  status       VARCHAR(20) NOT NULL,
  -- Kaynak: crm = Satış CRM projeksiyonu (senkron anahtarı ref_no); manual = elle.
  source       VARCHAR(20) NOT NULL DEFAULT 'manual',
  ref_no       VARCHAR(60),
  buyer_name   VARCHAR(200),
  -- İş karşılığı tarafı (cs_ref_vendors ile FK'sız — projeksiyon tablosu).
  vendor_id    BIGINT,
  -- Satış anında donan liste fiyatı (defterden kopya). İskonto = list − sale.
  list_price   NUMERIC(14,2) NOT NULL DEFAULT 0,
  sale_price   NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency     VARCHAR(3) NOT NULL DEFAULT 'TRY',
  reserved_at  DATE,
  sold_at      DATE,
  cancelled_at TIMESTAMPTZ,
  cancel_note  TEXT,
  note         TEXT,
  created_by   INT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cs_us_status_chk CHECK (status IN ('reserved', 'sold', 'barter', 'cancelled')),
  CONSTRAINT cs_us_source_chk CHECK (source IN ('crm', 'manual')),
  CONSTRAINT cs_us_price_chk  CHECK (list_price >= 0 AND sale_price >= 0),
  -- İş karşılığında karşı taraf taşerondur; rezerve/satışta alıcı adı şarttır.
  CONSTRAINT cs_us_barter_vendor_chk CHECK (status <> 'barter' OR vendor_id IS NOT NULL),
  CONSTRAINT cs_us_buyer_chk CHECK (status NOT IN ('reserved', 'sold') OR buyer_name IS NOT NULL)
);

-- Bir dairede TEK aktif satış: iptal edilen anahtarı boşaltır, daire yeniden
-- satılabilir; aktifken ikinci kayıt 23505 → 409 (yarışta da korur).
CREATE UNIQUE INDEX idx_cs_unit_sales_active_unit
  ON cs_unit_sales(location_id) WHERE status <> 'cancelled';

-- Senkron idempotensi: aynı CRM referansı iki kez eklenemez (ref_no'suz elle
-- girişler kısıt dışı).
CREATE UNIQUE INDEX idx_cs_unit_sales_ref
  ON cs_unit_sales(company_id, source, ref_no) WHERE ref_no IS NOT NULL;

CREATE INDEX idx_cs_unit_sales_project ON cs_unit_sales(company_id, project_id, status);

CREATE TRIGGER cs_unit_sales_updated_at
  BEFORE UPDATE ON cs_unit_sales
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

COMMENT ON TABLE cs_unit_sales IS
  'Bağımsız bölüm satış projeksiyonu (köprü: müşteri ilişkisi Satış CRM''de). barter = İş Karşılığı (taşerona verilen daire).';

-- ---------------------------------------------------------------------------
-- Tahsilat. kind='collection' tahsilat, kind='refund' iade (iptal sonrası para
-- iadesi de burada). İade ayrı SATIR: tahsilat satırını silmek/negatiflemek
-- yerine iz bırakır. Tutar hep pozitif; yön kind'dan gelir.
-- ---------------------------------------------------------------------------
CREATE TABLE cs_unit_payments (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INT    NOT NULL,
  sale_id     BIGINT NOT NULL REFERENCES cs_unit_sales(id) ON DELETE CASCADE,
  kind        VARCHAR(12) NOT NULL DEFAULT 'collection',
  paid_at     DATE NOT NULL,
  amount      NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  method      VARCHAR(20),
  note        TEXT,
  created_by  INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cs_up_kind_chk   CHECK (kind IN ('collection', 'refund')),
  CONSTRAINT cs_up_method_chk CHECK (method IS NULL OR method IN ('cash', 'bank', 'cheque', 'other'))
);

CREATE INDEX idx_cs_unit_payments_sale ON cs_unit_payments(sale_id);

COMMENT ON TABLE cs_unit_payments IS
  'Satış tahsilat/iade satırları. Muhasebe kaydı DEĞİL (köprü kararı) — şantiye tarafı takip defteri.';

-- ---------------------------------------------------------------------------
-- Müşteri değişiklik isteği (Imperium: "müşteri değişiklik talebi") — daire
-- özelinde kapsam değişikliği. ONAYLANAN bedel sözleşme değerine eklenir:
-- kalan = satış fiyatı + Σonaylı değişiklik − tahsilat.
-- ---------------------------------------------------------------------------
CREATE TABLE cs_unit_change_requests (
  id           BIGSERIAL PRIMARY KEY,
  company_id   INT    NOT NULL,
  sale_id      BIGINT NOT NULL REFERENCES cs_unit_sales(id) ON DELETE CASCADE,
  code         VARCHAR(20) NOT NULL,
  title        VARCHAR(200) NOT NULL,
  description  TEXT,
  -- Müşteriye yansıtılan bedel. Onaylanınca DONAR (sözleşmesel taahhüt).
  cost         NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  status       VARCHAR(20) NOT NULL DEFAULT 'open',
  requested_at DATE NOT NULL DEFAULT CURRENT_DATE,
  decided_at   DATE,
  decided_by   INT,
  done_at      DATE,
  note         TEXT,
  created_by   INT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cs_ucr_status_chk CHECK (status IN ('open', 'approved', 'rejected', 'done')),
  CONSTRAINT cs_ucr_code_uq UNIQUE (company_id, code)
);

CREATE INDEX idx_cs_ucr_sale ON cs_unit_change_requests(sale_id);

CREATE TRIGGER cs_unit_change_requests_updated_at
  BEFORE UPDATE ON cs_unit_change_requests
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

COMMENT ON TABLE cs_unit_change_requests IS
  'Müşteri değişiklik isteği (DGS-0001). Onaylı/biten bedel sözleşme değerine eklenir; onaydan sonra bedel donar.';

-- ---------------------------------------------------------------------------
-- ENVANTER GÖRÜNÜMÜ — projenin TÜM aktif daireleri (satışsızlar dahil).
-- sale_status 'available' TÜRETİLİR. Tahsilat/değişiklik toplamları fan-out
-- olmasın diye AYRI aggregate alt sorgulardan gelir (tek JOIN satır çoğaltırdı).
-- Parasal alanlar satışsız dairede NULL — 0 basmak "satıldı, bedava" okunur.
-- ---------------------------------------------------------------------------
CREATE VIEW cs_v_unit_inventory AS
SELECT l.company_id,
       l.project_id,
       l.id                                        AS location_id,
       l.code,
       l.name,
       l.path,
       l.unit_type,
       l.gross_area,
       l.net_area,
       l.facade,
       up.list_price                               AS book_list_price,
       s.id                                        AS sale_id,
       COALESCE(s.status, 'available')             AS sale_status,
       s.source,
       s.ref_no,
       s.buyer_name,
       s.vendor_id,
       s.list_price                                AS sale_list_price,
       s.sale_price,
       CASE WHEN s.id IS NOT NULL AND s.list_price > 0
            THEN s.list_price - s.sale_price END   AS discount,
       s.reserved_at,
       s.sold_at,
       CASE WHEN s.id IS NULL THEN NULL
            ELSE COALESCE(cr.approved_cost, 0) END AS change_order_total,
       CASE WHEN s.id IS NULL THEN NULL
            ELSE COALESCE(p.collected, 0) END      AS collected,
       CASE WHEN s.id IS NULL THEN NULL
            ELSE s.sale_price + COALESCE(cr.approved_cost, 0)
                 - COALESCE(p.collected, 0) END    AS remaining,
       COALESCE(cr.open_count, 0)                  AS open_change_requests
  FROM cs_locations l
  LEFT JOIN cs_unit_prices up ON up.location_id = l.id
  LEFT JOIN cs_unit_sales  s  ON s.location_id = l.id AND s.status <> 'cancelled'
  LEFT JOIN (
        SELECT sale_id,
               COALESCE(SUM(amount) FILTER (WHERE kind = 'collection'), 0)
             - COALESCE(SUM(amount) FILTER (WHERE kind = 'refund'), 0) AS collected
          FROM cs_unit_payments
         GROUP BY sale_id
       ) p ON p.sale_id = s.id
  LEFT JOIN (
        SELECT sale_id,
               SUM(cost) FILTER (WHERE status IN ('approved', 'done')) AS approved_cost,
               COUNT(*)  FILTER (WHERE status = 'open')                AS open_count
          FROM cs_unit_change_requests
         GROUP BY sale_id
       ) cr ON cr.sale_id = s.id
 WHERE l.kind = 'unit' AND l.active;

COMMENT ON VIEW cs_v_unit_inventory IS
  'Proje daire envanteri. sale_status=available türetilir; parasal alanlar satışsız dairede NULL. kalan = satış + onaylı değişiklik − tahsilat.';

-- ---------------------------------------------------------------------------
-- PROJE SATIŞ ÖZETİ. Satılan ve iş karşılığı verilen AYRI raporlanır: barter
-- nakit girişi değildir, taşeron borcunu mahsup eder — ikisini "ciro" diye
-- toplamak nakit beklentisini şişirir. Dürüst veri kalitesi göstergeleri:
--   unpriced_available_count — liste fiyatı girilmemiş boş daire
--   refund_liability         — iptal edilmiş satışlarda iade edilmemiş tahsilat
-- ---------------------------------------------------------------------------
CREATE VIEW cs_v_project_sales_summary AS
WITH inv AS (
  SELECT company_id,
         project_id,
         COUNT(*)                                                    AS unit_count,
         COUNT(*) FILTER (WHERE sale_status = 'available')           AS available_count,
         COUNT(*) FILTER (WHERE sale_status = 'reserved')            AS reserved_count,
         COUNT(*) FILTER (WHERE sale_status = 'sold')                AS sold_count,
         COUNT(*) FILTER (WHERE sale_status = 'barter')              AS barter_count,
         COALESCE(SUM(sale_price) FILTER (WHERE sale_status = 'sold'), 0)     AS sold_value,
         COALESCE(SUM(sale_price) FILTER (WHERE sale_status = 'reserved'), 0) AS reserved_value,
         COALESCE(SUM(sale_price) FILTER (WHERE sale_status = 'barter'), 0)   AS barter_value,
         COALESCE(SUM(change_order_total), 0)                        AS change_order_total,
         COALESCE(SUM(collected), 0)                                 AS collected_total,
         COALESCE(SUM(remaining), 0)                                 AS remaining_total,
         SUM(book_list_price) FILTER (WHERE sale_status = 'available')        AS available_list_value,
         COUNT(*) FILTER (WHERE sale_status = 'available'
                          AND book_list_price IS NULL)               AS unpriced_available_count,
         COALESCE(SUM(open_change_requests), 0)                      AS open_change_requests
    FROM cs_v_unit_inventory
   GROUP BY company_id, project_id
),
cancelled AS (
  SELECT s.company_id,
         s.project_id,
         COUNT(*) AS cancelled_count,
         COALESCE(SUM(p.collected), 0) AS refund_liability
    FROM cs_unit_sales s
    LEFT JOIN (
          SELECT sale_id,
                 COALESCE(SUM(amount) FILTER (WHERE kind = 'collection'), 0)
               - COALESCE(SUM(amount) FILTER (WHERE kind = 'refund'), 0) AS collected
            FROM cs_unit_payments
           GROUP BY sale_id
         ) p ON p.sale_id = s.id
   WHERE s.status = 'cancelled'
   GROUP BY s.company_id, s.project_id
)
SELECT inv.*,
       COALESCE(c.cancelled_count, 0)  AS cancelled_count,
       COALESCE(c.refund_liability, 0) AS refund_liability
  FROM inv
  LEFT JOIN cancelled c
    ON c.company_id = inv.company_id AND c.project_id = inv.project_id;

COMMENT ON VIEW cs_v_project_sales_summary IS
  'Proje satış özeti. sold/barter ayrı (barter nakit değil mahsup); refund_liability iptalde iade edilmemiş para.';
