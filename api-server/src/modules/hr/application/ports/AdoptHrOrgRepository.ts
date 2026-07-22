/**
 * AdoptHrOrgRepository PORT'u — normalize blob org satırlarının (org_units +
 * departments) TEK transaction'da devralınması. Implementasyon:
 * PgAdoptHrOrgRepository. Emsal: purchasing AdoptBlobRepository.
 *
 * Sözleşme:
 *   - Upsert anahtarı (company_id, client_id) (047 kolonları) → ikinci çağrı
 *     duplicate üretmez.
 *   - orgUnits.parentClientId / departments.orgUnitClientId önce BU çağrıda
 *     upsert edilen, sonra tabloda zaten var olan (önceki adopt) client_id'ler
 *     üzerinden çözülür; çözülemezse NULL (kolonlar nullable).
 *   - departments.managerEmployeeClientId employees.client_id (şirket kapsamlı)
 *     eşleşirse bağlanır, yoksa NULL.
 */
import type { NormalizedAdoptDepartment, NormalizedAdoptOrgUnit } from '../dto/AdoptHrOrgDtos.js';

export interface AdoptHrOrgPayload {
  orgUnits: ReadonlyArray<NormalizedAdoptOrgUnit>;
  departments: ReadonlyArray<NormalizedAdoptDepartment>;
}

export interface AdoptHrOrgOutcome {
  /** clientId → serverId (bu çağrıda upsert edilenler). */
  orgUnitIdByClient: Record<string, number>;
  departmentIdByClient: Record<string, number>;
}

export interface AdoptHrOrgRepository {
  adoptAll(companyId: number, payload: AdoptHrOrgPayload): Promise<AdoptHrOrgOutcome>;
}
