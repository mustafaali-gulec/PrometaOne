-- 010: Onay özeti görünümü vekâleten onayları da saymalı (FAZ 5 düzeltmesi).
--
-- HATA: cs_v_approval_flow_summary.approved_count yalnız decision='approved'
-- satırlarını sayıyordu. Vekâleten onay 'delegated' olarak işaretlenir ve
-- alan mantığında ONAY SAYILIR (akış min_approvals'a ulaşınca 'delegated'
-- satırlarla da kapanır). Sonuç: belge satırındaki "N/M" göstergesi vekâleten
-- onaylanan adımları görmezden geliyor, akış 'approved' olduğu halde rozet
-- "1/2" gösteriyordu. Canlı arayüz doğrulamasında yakalandı.
--
-- Aynı hata cs_v_my_pending_approvals'ta YOK — o görünüm yalnız 'pending'
-- adımlara bakıyor.
--
-- İdempotent: CREATE OR REPLACE VIEW, kolon listesi değişmediği için çalışır.

CREATE OR REPLACE VIEW cs_v_approval_flow_summary AS
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
       -- DÜZELTME: vekâleten onay da onaydır
       COUNT(s.id) FILTER (WHERE s.decision IN ('approved', 'delegated')) AS approved_count,
       COUNT(s.id) FILTER (WHERE s.decision = 'rejected')  AS rejected_count,
       COUNT(s.id) FILTER (WHERE s.decision = 'pending')   AS pending_count,
       COALESCE(f.min_approvals, COUNT(s.id))          AS required_count,
       CASE WHEN f.mode = 'ordered' THEN (
              SELECT s2.approver_user_id FROM cs_approval_steps s2
               WHERE s2.flow_id = f.id AND s2.decision = 'pending'
               ORDER BY s2.seq_no LIMIT 1
            ) END                                      AS current_approver_user_id,
       MIN(s.due_date) FILTER (WHERE s.decision = 'pending') AS next_due_date,
       CASE WHEN f.status = 'pending'
            THEN GREATEST(
                   0,
                   CURRENT_DATE - MIN(s.due_date) FILTER (WHERE s.decision = 'pending')
                 ) END                                 AS days_overdue
  FROM cs_approval_flows f
  LEFT JOIN cs_approval_steps s ON s.flow_id = f.id
 GROUP BY f.id, f.company_id, f.doc_kind, f.doc_id, f.project_id, f.mode, f.status,
          f.min_approvals, f.title, f.created_at, f.completed_at;

COMMENT ON VIEW cs_v_approval_flow_summary IS
  'Belge satırındaki N/M onay göstergesi. approved_count vekâleten onayları (delegated) da sayar.';
