/**
 * HR modülünde fırlatılan typed error'lar.
 * Presentation katmanı bunları uygun HTTP status'a çevirir.
 *
 * Bu dosya PR 1 için OrgUnit + Department odaklı error'ları içerir.
 * Position/Employee/Recruitment error'ları PR 2-3'te eklenir.
 */

// ============================================================================
// OrgUnit
// ============================================================================
export class OrgUnitNotFoundError extends Error {
  constructor(unitId: number) {
    super(`OrgUnit bulunamadı (id=${unitId})`);
    this.name = 'OrgUnitNotFoundError';
  }
}

export class OrgCycleDetectedError extends Error {
  constructor(unitId: number, attemptedParentId: number) {
    super(`OrgUnit (id=${unitId}) parent_id=${attemptedParentId}'a taşınamaz: cycle olur`);
    this.name = 'OrgCycleDetectedError';
  }
}

export class OrgUnitHasChildrenError extends Error {
  constructor(unitId: number) {
    super(`OrgUnit (id=${unitId}) alt birim içeriyor, silinemez/arşivlenemez`);
    this.name = 'OrgUnitHasChildrenError';
  }
}

export class OrgUnitCompanyMismatchError extends Error {
  constructor(unitId: number, expectedCompanyId: number) {
    super(`OrgUnit (id=${unitId}) bu şirkete (companyId=${expectedCompanyId}) ait değil`);
    this.name = 'OrgUnitCompanyMismatchError';
  }
}

// ============================================================================
// Department
// ============================================================================
export class DepartmentNotFoundError extends Error {
  constructor(departmentId: number) {
    super(`Department bulunamadı (id=${departmentId})`);
    this.name = 'DepartmentNotFoundError';
  }
}

export class DepartmentHasActiveEmployeesError extends Error {
  constructor(departmentId: number) {
    super(`Department (id=${departmentId}) aktif çalışan içeriyor, arşivlenemez`);
    this.name = 'DepartmentHasActiveEmployeesError';
  }
}

export class DepartmentCompanyMismatchError extends Error {
  constructor(departmentId: number, expectedCompanyId: number) {
    super(`Department (id=${departmentId}) bu şirkete (companyId=${expectedCompanyId}) ait değil`);
    this.name = 'DepartmentCompanyMismatchError';
  }
}
