-- ============================================================================
-- 008_manhours_productivity.sql — FAZ 4: ADAM×SAAT & VERİMLİLİK
--
-- Keşif satırı (poz) bazında işçilik performansı. Bugüne kadar keşifte yalnız
-- miktar ve tutar vardı; "bu pozu kaç adam-saatte yapmayı planladık, kaçta
-- yaptık" sorusu cevapsızdı. Oysa şantiyede kâr/zarar çoğunlukla burada kaybolur:
-- miktarın %50'sini yapmışken adam-saatin %70'ini yakmışsan, tutar tablosu hâlâ
-- iyi görünürken iş fiilen batıyordur.
--
-- İKİ AYRI "GERÇEKLEŞEN MİKTAR" KAYNAĞI — ikisi de tutulur, çünkü ikisi de doğru:
--   progress_qty : hakedişten (onaylı/ödenmiş) → MALİ gerçeklik
--   produced_qty : günlük rapor imalat kaydından (Faz 3) → FİZİKSEL gerçeklik
-- Aralarındaki fark tek başına bir yönetim bilgisidir: fiziksel üretim hakedişin
-- önündeyse hakediş kesilmemiş iş (nakit riski), gerisindeyse fazla hakediş
-- (denetim riski) vardır. Tek kaynağa indirmek bu sinyali yok eder.
--
-- ADAM×SAAT KAYNAKLARI:
--   kendi personeli → cs_timesheets (hours + overtime), boq_line_id üzerinden
--   taşeron         → cs_daily_log_entries kind='subcontractor', boq_line_id üzerinden
-- Makine saati adam-saat DEĞİLDİR; ayrı kolonda raporlanır (equip_hours).
-- ============================================================================

-- Birim adam×saat: bir birim imalat için planlanan işçilik (ör. 1 m³ kalıp = 2,5 a×s).
-- Analiz/rayiç kitaplarından ya da firmanın kendi geçmiş verisinden gelir.
ALTER TABLE cs_boq_lines
  ADD COLUMN unit_manhours NUMERIC(12, 4) NOT NULL DEFAULT 0
    CHECK (unit_manhours >= 0);

COMMENT ON COLUMN cs_boq_lines.unit_manhours IS
  'Birim başına planlanan adam×saat. Toplam planlanan = quantity * unit_manhours.';

-- ---------------------------------------------------------------------------
-- Gerçekleşen adam×saat — poz bazında, kaynağına göre ayrılmış
--
-- İki kaynak UNION ALL ile toplanır; ayrı ayrı da görünsün diye kaynak etiketi
-- korunur (kendi personeli mi taşeron mu sorusu maliyet analizinde ayrışır).
-- ---------------------------------------------------------------------------
CREATE VIEW cs_v_boq_manhours AS
WITH own_mh AS (
  SELECT ts.company_id,
         ts.boq_line_id,
         SUM(ts.hours + ts.overtime) AS manhours
    FROM cs_timesheets ts
   WHERE ts.boq_line_id IS NOT NULL
   GROUP BY ts.company_id, ts.boq_line_id
),
sub_mh AS (
  SELECT e.company_id,
         e.boq_line_id,
         SUM(e.hours) AS manhours
    FROM cs_daily_log_entries e
   WHERE e.kind = 'subcontractor'
     AND e.boq_line_id IS NOT NULL
     AND e.hours IS NOT NULL
   GROUP BY e.company_id, e.boq_line_id
),
equip AS (
  SELECT e.company_id,
         e.boq_line_id,
         SUM(e.hours) AS machine_hours
    FROM cs_daily_log_entries e
   WHERE e.kind = 'equipment'
     AND e.boq_line_id IS NOT NULL
     AND e.hours IS NOT NULL
   GROUP BY e.company_id, e.boq_line_id
)
SELECT l.company_id,
       l.id                              AS boq_line_id,
       COALESCE(o.manhours, 0)           AS own_manhours,
       COALESCE(s.manhours, 0)           AS sub_manhours,
       COALESCE(o.manhours, 0) + COALESCE(s.manhours, 0) AS actual_manhours,
       COALESCE(q.machine_hours, 0)      AS machine_hours
  FROM cs_boq_lines l
  LEFT JOIN own_mh o ON o.boq_line_id = l.id AND o.company_id = l.company_id
  LEFT JOIN sub_mh s ON s.boq_line_id = l.id AND s.company_id = l.company_id
  LEFT JOIN equip  q ON q.boq_line_id = l.id AND q.company_id = l.company_id;

-- ---------------------------------------------------------------------------
-- Poz bazlı performans satırı — Imperium'un Keşif ekranının karşılığı
--
-- ORAN HESAPLARINDA KURAL: payda 0 ise oran NULL döner, 0 DEĞİL. Planlanan
-- adam×saat girilmemiş bir pozda "verim %0" yazmak, verimin ölçülemediğini değil
-- kötü olduğunu söyler ve yanlış karara götürür. Arayüz NULL'u "—" gösterir.
-- ---------------------------------------------------------------------------
CREATE VIEW cs_v_boq_performance AS
WITH progress_qty AS (
  -- Hakedişten kümülatif miktar: en yüksek seq_no'lu ONAYLANMIŞ/ödenmiş hakediş
  -- satırının cumul_qty'si. Taslak/reddedilmiş hakediş sayılmaz.
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
  -- Poza doğrudan işlenmiş fiili gider (malzeme/taşeron faturası vb.)
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

       -- PLANLANAN
       l.quantity                                  AS planned_qty,
       l.unit_price,
       l.amount                                    AS planned_amount,
       l.pursantaj_pct,
       l.unit_manhours                             AS planned_unit_manhours,
       (l.quantity * l.unit_manhours)               AS planned_manhours,

       -- GERÇEKLEŞEN MİKTAR (iki kaynak)
       COALESCE(pq.progress_qty, 0)                AS progress_qty,
       COALESCE(pq.progress_amount, 0)             AS progress_amount,
       COALESCE(pr.produced_qty, 0)                AS produced_qty,

       -- GERÇEKLEŞEN ADAM×SAAT
       mh.own_manhours,
       mh.sub_manhours,
       mh.actual_manhours,
       mh.machine_hours,

       -- FİİLİ GİDER
       COALESCE(ex.expense_amount, 0)              AS expense_amount,

       -- TAMAMLANMA ORANLARI (payda 0 → NULL)
       CASE WHEN l.quantity > 0
            THEN COALESCE(pq.progress_qty, 0) * 100 / l.quantity END        AS progress_pct,
       CASE WHEN l.quantity > 0
            THEN COALESCE(pr.produced_qty, 0) * 100 / l.quantity END        AS produced_pct,
       CASE WHEN (l.quantity * l.unit_manhours) > 0
            THEN mh.actual_manhours * 100 / (l.quantity * l.unit_manhours) END AS manhour_pct,

       -- KAZANILAN PURSANTAJ: fiziksel üretimin proje pursantajına katkısı
       CASE WHEN l.quantity > 0
            THEN l.pursantaj_pct * COALESCE(pr.produced_qty, 0) / l.quantity END AS earned_pursantaj,

       -- VERİMLİLİK
       -- Gerçekleşen birim a×s = harcanan a×s / üretilen miktar
       CASE WHEN COALESCE(pr.produced_qty, 0) > 0
            THEN mh.actual_manhours / pr.produced_qty END                  AS actual_unit_manhours,
       -- Üretilen miktar için BEKLENEN a×s (plan birim a×s ile)
       (COALESCE(pr.produced_qty, 0) * l.unit_manhours)                     AS expected_manhours,
       -- Verim = beklenen / harcanan. >1 planın önünde, <1 gerisinde.
       CASE WHEN mh.actual_manhours > 0
            THEN (COALESCE(pr.produced_qty, 0) * l.unit_manhours) / mh.actual_manhours END AS efficiency,
       -- Adam×saat sapması: harcanan − beklenen. Pozitif = fazla harcandı.
       (mh.actual_manhours - (COALESCE(pr.produced_qty, 0) * l.unit_manhours)) AS manhour_variance

  FROM cs_boq_lines l
  JOIN cs_contracts c        ON c.id = l.contract_id
  JOIN cs_v_boq_manhours mh  ON mh.boq_line_id = l.id AND mh.company_id = l.company_id
  LEFT JOIN progress_qty pq  ON pq.boq_line_id = l.id
  LEFT JOIN produced pr      ON pr.boq_line_id = l.id
  LEFT JOIN expense ex       ON ex.boq_line_id = l.id;

COMMENT ON VIEW cs_v_boq_performance IS
  'Poz bazlı işçilik/miktar performansı. Oranlar payda 0 iken NULL döner (0 değil).';

-- ---------------------------------------------------------------------------
-- Sözleşme özeti — poz satırlarının ağırlıklı toplamı
--
-- Verim, satırların basit ortalaması DEĞİL, toplam beklenen / toplam harcanan
-- olarak hesaplanır: 1 adam-saatlik bir poz ile 10.000 adam-saatlik bir pozun
-- verimi aynı ağırlıkta sayılamaz.
-- ---------------------------------------------------------------------------
CREATE VIEW cs_v_contract_manhour_summary AS
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
       -- Ağırlıklı verim
       CASE WHEN SUM(actual_manhours) > 0
            THEN SUM(expected_manhours) / SUM(actual_manhours) END      AS efficiency
  FROM cs_v_boq_performance
 GROUP BY company_id, contract_id, project_id;

COMMENT ON VIEW cs_v_contract_manhour_summary IS
  'Sözleşme bazlı adam×saat özeti. Verim ağırlıklıdır (Σbeklenen / Σharcanan), satır ortalaması değil.';
