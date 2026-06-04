/**
 * OrgStructureReader — salt-okuma (read-only) org/departman hiyerarşisi +
 * kullanıcı scope portu.
 *
 * Concrete: infrastructure/persistence/PgOrgStructureReader.ts.
 *
 * PermissionResolver'ın cascade (department / org_unit) grant'larını
 * çözebilmesi için gereken minimal şekiller bu port üzerinden sağlanır.
 * AccessRepository DEĞİŞTİRİLMEZ — bu ayrı, salt-okuma bir porttur.
 *
 * Tüm metodlar company_id ile scope'lanır (multi-tenant izolasyon).
 */
import type {
  DepartmentNode,
  OrgUnitNode,
  UserScope,
} from '../../domain/services/PermissionResolver.js';

export interface OrgStructureReader {
  /** Şirketin tüm org_unit'lerini (id + parentId) döner. */
  listOrgUnits(companyId: number): Promise<ReadonlyArray<OrgUnitNode>>;

  /** Şirketin tüm departmanlarını (id + parentDeptId) döner. */
  listDepartments(companyId: number): Promise<ReadonlyArray<DepartmentNode>>;

  /**
   * Verilen username için UserScope çözer:
   * users.username → employees.user_id → department_id → org_unit_id.
   * Kullanıcının employee kaydı yoksa null döner.
   */
  resolveUserScope(username: string, companyId: number): Promise<UserScope | null>;
}
