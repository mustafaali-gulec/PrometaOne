/**
 * AdoptHrOrg DTO'ları — blob (promet:data) HR org yapısının (hrOrgUnits +
 * hrDepartments) tek seferlik, idempotent devralınması
 * (POST /v1/hr/org/adopt-blob). Emsal: purchasing AdoptBlobDtos.
 *
 * Girdi blob alan adlarıyla GEVŞEK gelir (appstate/domain/HrProjection.ts'te
 * doğrulanmış eşlemeden):
 *   orgUnits    ← hrOrgUnits    = { id:"ou_...", name, code?, parentId?, type?,
 *                                   managerEmployeeId?, authorizedUsers? }
 *   departments ← hrDepartments = { id:"dept_...", name, code?, color?,
 *                                   orgUnitId?, parentDeptId?,
 *                                   managerEmployeeId? }
 *
 * Şemada kolonu olmayan blob alanları taşınmaz: org_units.type/
 * managerEmployeeId/authorizedUsers, departments.color/parentDeptId.
 * departments.managerEmployeeId employees.client_id üzerinden çözülür
 * (bulunamazsa NULL).
 */

// ===== Girdi (gevşek blob kayıtları) ========================================

export interface AdoptHrOrgInput {
  companyId: number;
  orgUnits?: ReadonlyArray<Record<string, unknown>> | undefined;
  departments?: ReadonlyArray<Record<string, unknown>> | undefined;
}

// ===== Normalize satırlar (repository sözleşmesi) ===========================

export interface NormalizedAdoptOrgUnit {
  clientId: string;
  name: string;
  code: string | null;
  /** Blob hrOrgUnits id'si — repo önce bu çağrının haritasından, sonra
   *  DB'deki org_units.client_id'den (önceki adopt) çözer; çözülemezse NULL. */
  parentClientId: string | null;
}

export interface NormalizedAdoptDepartment {
  clientId: string;
  name: string;
  code: string | null;
  /** Blob hrOrgUnits id'si — org unit gibi çözülür; çözülemezse NULL. */
  orgUnitClientId: string | null;
  /** Blob hrEmployees id'si — employees.client_id eşleşirse bağlanır, yoksa NULL. */
  managerEmployeeClientId: string | null;
}

// ===== Sonuç ================================================================

export interface AdoptHrOrgResultDto {
  adopted: { orgUnits: number; departments: number };
  /** clientId → serverId (org_units/departments SERIAL id). */
  idMap: {
    orgUnits: Record<string, number>;
    departments: Record<string, number>;
  };
}
