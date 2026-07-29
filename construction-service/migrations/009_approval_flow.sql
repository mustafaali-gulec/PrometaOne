-- ============================================================================
-- 009_approval_flow.sql — FAZ 5: JENERİK ONAY AKIŞI
--
-- Şantiyede onay her belge tipinde tekrar eden bir örüntüdür: sözleşme, hakediş,
-- malzeme talebi, gider, günlük rapor, hasar-eksiklik... Bugüne kadar her belge
-- kendi ad-hoc çözümünü taşıyordu (hakedişte status + approved_by, malzeme
-- talebinde status) ve şu üçü hiçbirinde yoktu:
--   çok adımlı onay · onaycı başına bitiş tarihi · "kim onayladı, ne zaman" izi
--
-- Bu migration TEK bir akış motoru kurar ve belgeye POLİMORFİK bağlanır
-- (doc_kind + doc_id). Alternatif — her belge tipine ayrı onay tablosu — 11 tablo
-- ve 11 CRUD demekti; üstelik "bana atanan onaylar" kutusu 11 tabloyu UNION
-- etmek zorunda kalırdı ki bu kutu bütün özelliğin en çok kullanılan parçasıdır.
--
-- POLİMORFİK REFERANSIN BEDELİ: FK yok, dolayısıyla belge silinirse akış yetim
-- kalır. Bilinçli kabul: belgeler pratikte silinmez (pasife çekilir) ve akış
-- kaydının kendisi bir denetim izidir — belge gitse bile "şu belge şu tarihte
-- şu kişiler tarafından onaylanmıştı" bilgisi korunmalıdır.
--
-- İKİ MOD:
--   ordered   → sırayla; yalnız en küçük bekleyen sıra karar verebilir
--   unordered → Imperium'daki "Sırasız Onay Akışı"; bekleyen herkes karar verebilir
--
-- min_approvals: NULL ise HERKES onaylamalı. Sayı ise (ör. 3 onaycıdan 2'si)
-- o sayıya ulaşınca akış onaylanır — kurul/komisyon onayları için gerçek ihtiyaç.
--
-- RED TERMİNALDİR: bir red bütün akışı reddeder, kalan onaycılara sorulmaz.
-- Şantiyede güvenli varsayılan bu: reddedilmiş bir hakediş "çoğunluk onayladı"
-- diye ilerlememelidir.
-- ============================================================================

CREATE TYPE cs_approval_doc_kind AS ENUM (
  'contract',
  'progress',
  'material_request',
  'expense',
  'advance',
  'daily_log',
  'tracking',
  'boq',
  'measurement',
  'payment'
);

CREATE TYPE cs_approval_mode AS ENUM ('ordered', 'unordered');

CREATE TYPE cs_approval_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- 'skipped' : min_approvals'a ulaşıldığı için artık sorulmayan adım
-- 'delegated': onaycı adına başkası karar verdi (decided_by ile izlenir)
CREATE TYPE cs_approval_decision AS ENUM (
  'pending', 'approved', 'rejected', 'skipped', 'delegated'
);

CREATE TABLE cs_approval_flows (
  id            BIGSERIAL PRIMARY KEY,
  company_id    INT NOT NULL,
  doc_kind      cs_approval_doc_kind NOT NULL,
  doc_id        BIGINT NOT NULL,               -- polimorfik soft ref
  /** Rapor/filtre kolaylığı: akışın ait olduğu proje (belgeden türetilip yazılır). */
  project_id    BIGINT REFERENCES cs_projects(id) ON DELETE SET NULL,
  mode          cs_approval_mode   NOT NULL DEFAULT 'ordered',
  status        cs_approval_status NOT NULL DEFAULT 'pending',
  /** NULL = herkes onaylamalı. Sayı = bu kadar onay yeter. */
  min_approvals INT CHECK (min_approvals IS NULL OR min_approvals > 0),
  title         VARCHAR(300),
  note          TEXT,
  created_by    INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  -- Bir belgede aynı anda tek AKTİF akış olabilir; kapanmışlar tarih arşivi.
  -- Kısmi UNIQUE indeks aşağıda (CHECK ile ifade edilemez).
  CONSTRAINT cs_af_completed_audit
    CHECK (status = 'pending' OR completed_at IS NOT NULL)
);

CREATE UNIQUE INDEX idx_cs_af_one_active
  ON cs_approval_flows(company_id, doc_kind, doc_id)
  WHERE status = 'pending';

CREATE INDEX idx_cs_af_doc     ON cs_approval_flows(doc_kind, doc_id);
CREATE INDEX idx_cs_af_project ON cs_approval_flows(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_cs_af_status  ON cs_approval_flows(company_id, status);

CREATE TRIGGER cs_approval_flows_updated_at
  BEFORE UPDATE ON cs_approval_flows
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

CREATE TABLE cs_approval_steps (
  id               BIGSERIAL PRIMARY KEY,
  company_id       INT NOT NULL,
  flow_id          BIGINT NOT NULL REFERENCES cs_approval_flows(id) ON DELETE CASCADE,
  seq_no           INT NOT NULL,
  approver_user_id INT NOT NULL,                -- soft ref → users
  due_date         DATE,
  decision         cs_approval_decision NOT NULL DEFAULT 'pending',
  decided_at       TIMESTAMPTZ,
  /** Vekâleten karar: gerçek karar veren. approver_user_id'den farklıysa vekâlet. */
  decided_by       INT,
  comment          VARCHAR(1000),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (flow_id, seq_no),
  -- Aynı kişi aynı akışta iki kez onaycı olamaz: "2/3 onay" sayımı bozulur.
  UNIQUE (flow_id, approver_user_id),
  -- Karar verilmişse zaman damgası zorunlu; "onaylandı ama ne zaman bilinmiyor"
  -- bir denetim izinde kabul edilemez.
  CONSTRAINT cs_as_decision_audit
    CHECK (decision = 'pending' OR decided_at IS NOT NULL)
);

CREATE INDEX idx_cs_as_flow     ON cs_approval_steps(flow_id, seq_no);
-- "Bana atanan onaylar" kutusunun ana sorgusu
CREATE INDEX idx_cs_as_approver ON cs_approval_steps(approver_user_id, decision)
  WHERE decision = 'pending';

CREATE TRIGGER cs_approval_steps_updated_at
  BEFORE UPDATE ON cs_approval_steps
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- Denetim izi: adım kararları dışındaki olaylar da (akış kurulumu, iptal,
-- onaycı ekleme/çıkarma) buraya düşer.
CREATE TABLE cs_approval_history (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INT NOT NULL,
  flow_id     BIGINT NOT NULL REFERENCES cs_approval_flows(id) ON DELETE CASCADE,
  step_id     BIGINT REFERENCES cs_approval_steps(id) ON DELETE SET NULL,
  action      VARCHAR(40) NOT NULL,   -- created | approved | rejected | cancelled | reopened | step_added | step_removed
  actor       INT,
  note        VARCHAR(1000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cs_ah_flow ON cs_approval_history(flow_id, created_at DESC);

-- ============================================================================
-- ÖZET VIEW'LARI
-- ============================================================================

-- Akış başlığı + N/M göstergesi + sıradaki onaycı + gecikme.
-- Imperium'un her belge satırındaki "Onay Sırası 2/3" göstergesi buradan gelir.
CREATE VIEW cs_v_approval_flow_summary AS
SELECT f.id                                            AS flow_id,
       f.company_id,
       f.doc_kind,
       f.doc_id,
       f.project_id,
       f.mode,
       f.status,
       f.min_approvals,
       f.title,
       f.created_at,
       f.completed_at,
       COUNT(s.id)                                     AS step_count,
       COUNT(s.id) FILTER (WHERE s.decision = 'approved')  AS approved_count,
       COUNT(s.id) FILTER (WHERE s.decision = 'rejected')  AS rejected_count,
       COUNT(s.id) FILTER (WHERE s.decision = 'pending')   AS pending_count,
       -- Gereken onay sayısı: min_approvals verilmişse o, yoksa tüm adımlar
       COALESCE(f.min_approvals, COUNT(s.id))          AS required_count,
       -- Sıralı modda sıradaki onaycı; sırasızda NULL (herkes aynı anda)
       CASE WHEN f.mode = 'ordered' THEN (
              SELECT s2.approver_user_id FROM cs_approval_steps s2
               WHERE s2.flow_id = f.id AND s2.decision = 'pending'
               ORDER BY s2.seq_no LIMIT 1
            ) END                                      AS current_approver_user_id,
       -- En yakın bitiş tarihi (bekleyen adımlar arasında)
       MIN(s.due_date) FILTER (WHERE s.decision = 'pending') AS next_due_date,
       -- Gecikme: bugün en yakın bitiş tarihini geçtiyse kaç gün.
       -- Kapanmış akışta gecikme YOKTUR (tamamlanmış işi geç göstermek yanıltır).
       CASE WHEN f.status = 'pending'
            THEN GREATEST(
                   0,
                   CURRENT_DATE - MIN(s.due_date) FILTER (WHERE s.decision = 'pending')
                 ) END                                 AS days_overdue
  FROM cs_approval_flows f
  LEFT JOIN cs_approval_steps s ON s.flow_id = f.id
 GROUP BY f.id, f.company_id, f.doc_kind, f.doc_id, f.project_id, f.mode, f.status,
          f.min_approvals, f.title, f.created_at, f.completed_at;

-- "Bana atanan onaylar" kutusu: bekleyen adımlar + belge künyesi + eyleme
-- geçilebilir mi (sıralı modda sıra bende mi?).
CREATE VIEW cs_v_my_pending_approvals AS
SELECT s.id                     AS step_id,
       s.company_id,
       s.approver_user_id,
       s.seq_no,
       s.due_date,
       f.id                     AS flow_id,
       f.doc_kind,
       f.doc_id,
       f.project_id,
       f.mode,
       f.title,
       f.created_at             AS flow_created_at,
       -- Sıralı modda yalnız en küçük bekleyen sıra eyleme geçebilir
       CASE WHEN f.mode = 'unordered' THEN TRUE
            ELSE s.seq_no = (
              SELECT MIN(s3.seq_no) FROM cs_approval_steps s3
               WHERE s3.flow_id = f.id AND s3.decision = 'pending'
            ) END               AS actionable,
       CASE WHEN s.due_date IS NULL THEN NULL
            ELSE GREATEST(0, CURRENT_DATE - s.due_date) END AS days_overdue
  FROM cs_approval_steps s
  JOIN cs_approval_flows f ON f.id = s.flow_id
 WHERE s.decision = 'pending' AND f.status = 'pending';

COMMENT ON TABLE cs_approval_flows IS
  'Jenerik onay akışı. Belgeye polimorfik bağlanır (doc_kind + doc_id); FK yoktur, akış kaydı denetim izidir.';
COMMENT ON COLUMN cs_approval_flows.min_approvals IS
  'NULL = herkes onaylamalı. Sayı = bu kadar onay yeter (kurul onayı).';
COMMENT ON VIEW cs_v_my_pending_approvals IS
  'Bana atanan bekleyen onaylar. actionable=false ise sıralı akışta sıra henüz bu kişide değil.';
