-- ============================================================================
-- 012_commitments_evm.sql — FAZ 7: TAAHHÜT (SİPARİŞLER) & EVM
--
-- Imperium'un Keşif ekranındaki son iki kolon grubu: SİPARİŞLER (taahhüt) ve
-- GİDERLER (fiili). Fiili gider Faz 4'ten beri var (cs_expenses → expense_amount);
-- eksik olan TAAHHÜT: verilmiş ama henüz faturalanmamış siparişlerin tutarı.
--
-- Taahhüt olmadan bütçe tablosu YALAN SÖYLER: 1M bütçeli pozda 100K harcanmış
-- görünür ama 800K'lık sipariş yoldaysa gerçek maruziyet 900K'dır. Şantiyede
-- "bütçe var sanıp sipariş verme" hatası tam bu kör noktadan çıkar.
--
-- KÖPRÜ KARARI (kullanıcı onaylı): satınalma ŞANTİYEDE İKİZLENMEZ. Monolitin
-- /v1/purchasing'i kaynak-of-truth kalır; buradaki cs_commitments bir
-- PROJEKSİYONDUR. (company_id, source, ref_no, ref_line_no) üzerindeki UNIQUE
-- kısıt sayesinde senkron ucu idempotent upsert yapar — aynı sipariş satırı iki
-- kez gönderilse tek kayıt kalır. Elle giriş (source='manual') da desteklenir:
-- her taahhüt PO değildir (taşeron sözleşmesi, kira, nakliye anlaşması).
-- ============================================================================

CREATE TABLE cs_commitments (
  id             BIGSERIAL PRIMARY KEY,
  company_id     INT    NOT NULL,
  project_id     BIGINT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
  contract_id    BIGINT REFERENCES cs_contracts(id) ON DELETE SET NULL,
  boq_line_id    BIGINT REFERENCES cs_boq_lines(id) ON DELETE SET NULL,
  location_id    BIGINT REFERENCES cs_locations(id) ON DELETE SET NULL,
  -- Kaynak: purchase_order = monolit satınalmadan senkron; subcontract = taşeron
  -- anlaşması; manual = elle giriş. Kaynak tipi raporda ayrışır (PO'lar teslim
  -- alındıkça kapanır, taşeron taahhüdü hakedişle erir).
  source         VARCHAR(20)  NOT NULL DEFAULT 'manual',
  -- Kaynak belge no (PO no / sözleşme no). Senkron anahtarının parçası.
  ref_no         VARCHAR(60)  NOT NULL,
  ref_line_no    INT          NOT NULL DEFAULT 1,
  vendor_id      BIGINT,
  description    VARCHAR(500) NOT NULL,
  quantity       NUMERIC(20,3) NOT NULL DEFAULT 1,
  unit           VARCHAR(20),
  unit_price     NUMERIC(20,4) NOT NULL DEFAULT 0,
  amount         NUMERIC(20,2) NOT NULL DEFAULT 0,
  -- Teslim alınan / faturalanan kısım: bu kadarı artık taahhüt DEĞİL, fiiliye
  -- dönmüş (cs_expenses'e düşmüş) demektir. Açık taahhüt = amount − delivered.
  delivered_amount NUMERIC(20,2) NOT NULL DEFAULT 0,
  currency       VARCHAR(3)   NOT NULL DEFAULT 'TRY',
  status         VARCHAR(20)  NOT NULL DEFAULT 'open',
  committed_at   DATE NOT NULL DEFAULT CURRENT_DATE,
  closed_at      TIMESTAMPTZ,
  note           TEXT,
  created_by     INT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cs_cmt_source_chk CHECK (source IN ('purchase_order', 'subcontract', 'manual')),
  CONSTRAINT cs_cmt_status_chk CHECK (status IN ('open', 'partial', 'closed', 'cancelled')),
  CONSTRAINT cs_cmt_amount_chk CHECK (amount >= 0),
  CONSTRAINT cs_cmt_delivered_chk CHECK (delivered_amount >= 0 AND delivered_amount <= amount),
  -- Senkron idempotensi: aynı kaynak satırı iki kez eklenemez.
  CONSTRAINT cs_cmt_ref_uq UNIQUE (company_id, source, ref_no, ref_line_no)
);

CREATE INDEX idx_cs_cmt_project  ON cs_commitments(company_id, project_id, status);
CREATE INDEX idx_cs_cmt_boq      ON cs_commitments(boq_line_id) WHERE boq_line_id IS NOT NULL;
CREATE INDEX idx_cs_cmt_contract ON cs_commitments(contract_id) WHERE contract_id IS NOT NULL;
CREATE INDEX idx_cs_cmt_vendor   ON cs_commitments(company_id, vendor_id) WHERE vendor_id IS NOT NULL;

COMMENT ON TABLE cs_commitments IS
  'Taahhüt projeksiyonu (Imperium "Siparişler" kolonu). Satınalma monolitte kaynak-of-truth; burası idempotent senkronla beslenir + elle giriş.';
COMMENT ON COLUMN cs_commitments.delivered_amount IS
  'Teslim alınan/faturalanan kısım — artık taahhüt değil fiili. Açık taahhüt = amount − delivered_amount.';

-- ---------------------------------------------------------------------------
-- Poz bazında taahhüt toplamı.
--
-- AÇIK TAAHHÜT yalnız open/partial durumlarından gelir: kapanmış taahhüdün
-- tamamı fiiliye dönmüştür (expense olarak zaten sayılıyor), iptal edilmişin
-- maruziyeti yoktur. committed_total ise durum bağımsız tarihsel toplamdır
-- ("bu poza toplam ne sipariş verildi" sorusu ayrıca sorulur).
-- ---------------------------------------------------------------------------
CREATE VIEW cs_v_boq_committed AS
SELECT m.company_id,
       m.boq_line_id,
       SUM(m.amount) FILTER (WHERE m.status <> 'cancelled')            AS committed_total,
       SUM(m.amount - m.delivered_amount)
         FILTER (WHERE m.status IN ('open', 'partial'))                AS open_committed
  FROM cs_commitments m
 WHERE m.boq_line_id IS NOT NULL
 GROUP BY m.company_id, m.boq_line_id;

-- ---------------------------------------------------------------------------
-- cs_v_boq_performance — SONA yeni kolonlar (CREATE OR REPLACE yalnız sona
-- eklemeye izin verir; mevcut kolonların adı/sırası/tipi DEĞİŞMEZ).
--
--   committed_amount      : poza verilen toplam sipariş (iptal hariç)
--   open_committed_amount : açık taahhüt (verilmiş, henüz fiiliye dönmemiş)
--   cost_exposure         : fiili + açık taahhüt = gerçek maruziyet
--   budget_variance       : planlanan − maruziyet. NEGATİF = poz bütçeyi aşmış
--                           ya da aşmak üzere — sipariş verilirken görünmeli.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW cs_v_boq_performance AS
WITH progress_qty AS (
  SELECT pl.boq_line_id,
         MAX(pl.cumul_qty)   AS progress_qty,
         MAX(pl.cumul_amount) AS progress_amount
    FROM cs_progress_lines pl
    JOIN cs_progress_payments pp ON pp.id = pl.progress_id
   WHERE pp.status IN ('approved', 'paid')
   GROUP BY pl.boq_line_id
),
produced AS (
  SELECT e.boq_line_id,
         SUM(e.qty) AS produced_qty
    FROM cs_daily_log_entries e
   WHERE e.kind = 'production' AND e.boq_line_id IS NOT NULL AND e.qty IS NOT NULL
   GROUP BY e.boq_line_id
),
expense AS (
  SELECT x.boq_line_id, SUM(x.amount) AS expense_amount
    FROM cs_expenses x
   WHERE x.boq_line_id IS NOT NULL
   GROUP BY x.boq_line_id
)
SELECT l.company_id,
       l.contract_id,
       c.project_id,
       l.id                                        AS boq_line_id,
       l.line_no,
       l.poz_no,
       l.description,
       l.unit,
       l.location_id,

       l.quantity                                  AS planned_qty,
       l.unit_price,
       l.amount                                    AS planned_amount,
       l.pursantaj_pct,
       l.unit_manhours                             AS planned_unit_manhours,
       (l.quantity * l.unit_manhours)               AS planned_manhours,

       COALESCE(pq.progress_qty, 0)                AS progress_qty,
       COALESCE(pq.progress_amount, 0)             AS progress_amount,
       COALESCE(pr.produced_qty, 0)                AS produced_qty,

       mh.own_manhours,
       mh.sub_manhours,
       mh.actual_manhours,
       mh.machine_hours,

       COALESCE(ex.expense_amount, 0)              AS expense_amount,

       CASE WHEN l.quantity > 0
            THEN COALESCE(pq.progress_qty, 0) * 100 / l.quantity END        AS progress_pct,
       CASE WHEN l.quantity > 0
            THEN COALESCE(pr.produced_qty, 0) * 100 / l.quantity END        AS produced_pct,
       CASE WHEN (l.quantity * l.unit_manhours) > 0
            THEN mh.actual_manhours * 100 / (l.quantity * l.unit_manhours) END AS manhour_pct,

       CASE WHEN l.quantity > 0
            THEN l.pursantaj_pct * COALESCE(pr.produced_qty, 0) / l.quantity END AS earned_pursantaj,

       CASE WHEN COALESCE(pr.produced_qty, 0) > 0
            THEN mh.actual_manhours / pr.produced_qty END                  AS actual_unit_manhours,
       (COALESCE(pr.produced_qty, 0) * l.unit_manhours)                     AS expected_manhours,
       CASE WHEN mh.actual_manhours > 0
            THEN (COALESCE(pr.produced_qty, 0) * l.unit_manhours) / mh.actual_manhours END AS efficiency,
       (mh.actual_manhours - (COALESCE(pr.produced_qty, 0) * l.unit_manhours)) AS manhour_variance,

       -- FAZ 7 — TAAHHÜT & MALİYET (yeni kolonlar SONDA)
       COALESCE(cm.committed_total, 0)             AS committed_amount,
       COALESCE(cm.open_committed, 0)              AS open_committed_amount,
       (COALESCE(ex.expense_amount, 0) + COALESCE(cm.open_committed, 0)) AS cost_exposure,
       (l.amount - COALESCE(ex.expense_amount, 0) - COALESCE(cm.open_committed, 0)) AS budget_variance

  FROM cs_boq_lines l
  JOIN cs_contracts c        ON c.id = l.contract_id
  JOIN cs_v_boq_manhours mh  ON mh.boq_line_id = l.id AND mh.company_id = l.company_id
  LEFT JOIN progress_qty pq  ON pq.boq_line_id = l.id
  LEFT JOIN produced pr      ON pr.boq_line_id = l.id
  LEFT JOIN expense ex       ON ex.boq_line_id = l.id
  LEFT JOIN cs_v_boq_committed cm ON cm.boq_line_id = l.id AND cm.company_id = l.company_id;

COMMENT ON VIEW cs_v_boq_performance IS
  'Poz bazlı performans + taahhüt/maliyet (Faz 7). Oranlar payda 0 iken NULL; budget_variance negatifse poz maruziyeti bütçeyi aşmış.';

-- Sözleşme özeti de sona eklenen kolonlarla genişler.
CREATE OR REPLACE VIEW cs_v_contract_manhour_summary AS
SELECT company_id,
       contract_id,
       project_id,
       COUNT(*)                        AS line_count,
       SUM(planned_manhours)           AS planned_manhours,
       SUM(actual_manhours)            AS actual_manhours,
       SUM(own_manhours)               AS own_manhours,
       SUM(sub_manhours)               AS sub_manhours,
       SUM(machine_hours)              AS machine_hours,
       SUM(expected_manhours)          AS expected_manhours,
       SUM(manhour_variance)           AS manhour_variance,
       SUM(planned_amount)             AS planned_amount,
       SUM(progress_amount)            AS progress_amount,
       SUM(expense_amount)             AS expense_amount,
       SUM(COALESCE(earned_pursantaj, 0)) AS earned_pursantaj,
       CASE WHEN SUM(planned_manhours) > 0
            THEN SUM(actual_manhours) * 100 / SUM(planned_manhours) END AS manhour_pct,
       CASE WHEN SUM(actual_manhours) > 0
            THEN SUM(expected_manhours) / SUM(actual_manhours) END      AS efficiency,
       -- FAZ 7 (sona eklendi)
       SUM(committed_amount)           AS committed_amount,
       SUM(open_committed_amount)      AS open_committed_amount,
       SUM(cost_exposure)              AS cost_exposure,
       SUM(budget_variance)            AS budget_variance
  FROM cs_v_boq_performance
 GROUP BY company_id, contract_id, project_id;

-- ---------------------------------------------------------------------------
-- SÖZLEŞME EVM ÖZETİ
--
-- Dürüst EVM: elimizde zaman-fazlı bütçe (baseline) YOK, o yüzden SPI ve
-- klasik EAC HESAPLANMAZ — uydurma SPI, yanlış güven verir. Olan veriden
-- türetilebilenler:
--   bac            : sözleşme keşif toplamı (Budget At Completion)
--   ev             : hakediş kümülatifi (Earned Value — onaylı/ödenmiş)
--   ac             : fiili gider (Actual Cost)
--   open_committed : açık taahhüt
--   cost_exposure  : ac + açık taahhüt
--   cpi            : ev / ac (payda 0 → NULL). <1 = kazandığından çok harcıyor.
--   budget_remaining : bac − cost_exposure. Sipariş vermeden önce bakılacak sayı.
--   pct_earned / pct_spent / pct_committed : bac'a oranlar (bac 0 → NULL).
--
-- POZA BAĞLANMAMIŞ taahhüt/gider sözleşme toplamında SAYILMAZ (boq_line_id
-- NULL satırlar poz görünümünden gelmez). Proje EVM'i ise projedeki HER
-- taahhüt/gideri sayar — iki görünümün farkı "poza işlenmemiş maliyet"tir ve
-- bu fark tek başına bir veri kalitesi göstergesidir.
-- ---------------------------------------------------------------------------
CREATE VIEW cs_v_contract_evm AS
SELECT s.company_id,
       s.contract_id,
       s.project_id,
       s.line_count,
       s.planned_amount                             AS bac,
       s.progress_amount                            AS ev,
       s.expense_amount                             AS ac,
       s.committed_amount,
       s.open_committed_amount                      AS open_committed,
       s.cost_exposure,
       (s.planned_amount - s.cost_exposure)         AS budget_remaining,
       CASE WHEN s.expense_amount > 0
            THEN s.progress_amount / s.expense_amount END       AS cpi,
       CASE WHEN s.planned_amount > 0
            THEN s.progress_amount * 100 / s.planned_amount END AS pct_earned,
       CASE WHEN s.planned_amount > 0
            THEN s.expense_amount * 100 / s.planned_amount END  AS pct_spent,
       CASE WHEN s.planned_amount > 0
            THEN s.cost_exposure * 100 / s.planned_amount END   AS pct_exposure
  FROM cs_v_contract_manhour_summary s;

COMMENT ON VIEW cs_v_contract_evm IS
  'Sözleşme EVM özeti. SPI/EAC bilerek yok: zaman-fazlı baseline olmadan hesaplanamaz, uydurmak yanlış güven verir.';

-- Proje bazında taahhüt özeti — poza bağlanmamış taahhütler DAHİL.
CREATE VIEW cs_v_project_commitments AS
SELECT m.company_id,
       m.project_id,
       COUNT(*)                                                          AS commitment_count,
       COUNT(*) FILTER (WHERE m.status IN ('open', 'partial'))            AS open_count,
       SUM(m.amount) FILTER (WHERE m.status <> 'cancelled')              AS committed_total,
       COALESCE(SUM(m.amount - m.delivered_amount)
         FILTER (WHERE m.status IN ('open', 'partial')), 0)              AS open_committed,
       COUNT(*) FILTER (WHERE m.boq_line_id IS NULL AND m.status <> 'cancelled')
                                                                          AS unlinked_count,
       COALESCE(SUM(m.amount)
         FILTER (WHERE m.boq_line_id IS NULL AND m.status <> 'cancelled'), 0)
                                                                          AS unlinked_amount
  FROM cs_commitments m
 GROUP BY m.company_id, m.project_id;

COMMENT ON VIEW cs_v_project_commitments IS
  'Proje taahhüt özeti. unlinked_* poza bağlanmamış taahhüdü gösterir — veri kalitesi göstergesi.';
