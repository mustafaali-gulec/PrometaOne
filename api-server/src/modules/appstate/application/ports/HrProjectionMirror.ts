/**
 * HrProjectionMirror PORT'u — blob HR çekirdeği projeksiyonunun (HrProjection)
 * MEVCUT normalize hr tablolarına (org_units/departments/positions/employees/
 * candidates/applications/hr_leave_requests/hr_payroll_runs+items/hr_assets+
 * assignments) yazılması. Implementasyon: PgHrProjectionRepository
 * (047_hr_projection.sql).
 *
 * replaceAll TEK transaction'dır ve yalnız projeksiyon-sahipli satırlara
 * (client_id IS NOT NULL) dokunur: üst entiteler upsert + prune (serial id
 * kararlı — CRUD FK'ları süpürülmez), detaylar (applications, hr_leave_requests,
 * hr_payroll_items, hr_asset_assignments) delete-then-insert. Boş projeksiyon,
 * projeksiyon-sahipli tüm satırları budar; hr CRUD'unun kendi satırları
 * (client_id IS NULL) korunur.
 */
import type { HrProjection } from '../../domain/HrProjection.js';

export interface HrProjectionMirror {
  replaceAll(projection: HrProjection): Promise<void>;
}
