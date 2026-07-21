/**
 * AccessProjectionMirror PORT'u — blob RBAC projeksiyonunun (AccessProjection)
 * access_* tablolarına yazılması. Implementasyon:
 * PgAccessProjectionRepository (046_access_projection.sql).
 *
 * replaceAll TEK transaction'dır ve yalnız projeksiyon-sahipli satırlara
 * (client_id IS NOT NULL) dokunur: upsert + prune. Boş projeksiyon,
 * projeksiyon-sahipli tüm satırları budar (blob koleksiyonları boşaltıldı);
 * access CRUD'unun kendi satırları (client_id IS NULL) korunur.
 */
import type { AccessProjection } from '../../domain/AccessProjection.js';

export interface AccessProjectionMirror {
  replaceAll(projection: AccessProjection): Promise<void>;
}
