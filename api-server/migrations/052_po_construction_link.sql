-- ============================================================================
-- 052_po_construction_link.sql — SATINALMA → ŞANTİYE TAAHHÜT KÖPRÜSÜ
--
-- Köprü kararı (şantiye revizyonu): satınalma şantiyede İKİZLENMEZ; monolit
-- kaynak-of-truth kalır ve sipariş tutarları construction-service'teki
-- cs_commitments PROJEKSİYONUNA idempotent senkronla akar (POST
-- /v1/construction/commitments/sync — anahtar: source+refNo+refLineNo).
--
-- Bu migration köprünün monolit ucunu açar: siparişe İSTEĞE BAĞLI şantiye
-- bağı. FK YOK — cs_projects/cs_boq_lines başka serviste (DB-per-service);
-- doğrulama senkron ucunda yapılır ve hatalı satır errors[] ile raporlanır.
-- Bağı olmayan sipariş senkrona hiç gitmez.
-- ============================================================================

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS construction_project_id BIGINT;

ALTER TABLE purchase_order_lines
  ADD COLUMN IF NOT EXISTS construction_boq_line_id BIGINT;

COMMENT ON COLUMN purchase_orders.construction_project_id IS
  'İsteğe bağlı şantiye bağı (cs_projects id — çapraz servis, FK''sız). Doluysa sipariş taahhüt projeksiyonuna senkronlanır.';
COMMENT ON COLUMN purchase_order_lines.construction_boq_line_id IS
  'İsteğe bağlı poz bağı (cs_boq_lines id). Poza bağlı taahhüt keşif ekranındaki Siparişler kolonuna düşer; bağsız satır proje özetinde unlinked_* olarak raporlanır.';
