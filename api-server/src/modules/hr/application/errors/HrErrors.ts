/**
 * HR modülünde fırlatılan typed error'lar.
 * Presentation katmanı bunları uygun HTTP status'a çevirir.
 *
 * PR 1: OrgUnit + Department
 * PR 2: Position + Employee (bu PR)
 * PR 3: Recruitment (Candidate + Application)
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

// ===================

// ============================================================================
// Position
// ============================================================================
export class PositionNotFoundError extends Error {
  constructor(positionId: number) {
    super(`Position bulunamadı (id=${positionId})`);
    this.name = 'PositionNotFoundError';
  }
}

export class PositionCompanyMismatchError extends Error {
  constructor(positionId: number, expectedCompanyId: number) {
    super(`Position (id=${positionId}) bu şirkete (companyId=${expectedCompanyId}) ait değil`);
    this.name = 'PositionCompanyMismatchError';
  }
}

export class PositionHasActiveEmployeesError extends Error {
  constructor(positionId: number) {
    super(`Position (id=${positionId}) aktif çalışan içeriyor, kapatma uyarısı`);
    this.name = 'PositionHasActiveEmployeesError';
  }
}

// ============================================================================
// Employee
// ============================================================================
export class EmployeeNotFoundError extends Error {
  constructor(employeeId: number) {
    super(`Employee bulunamadı (id=${employeeId})`);
    this.name = 'EmployeeNotFoundError';
  }
}

export class EmployeeCompanyMismatchError extends Error {
  constructor(employeeId: number, expectedCompanyId: number) {
    super(`Employee (id=${employeeId}) bu şirkete (companyId=${expectedCompanyId}) ait değil`);
    this.name = 'EmployeeCompanyMismatchError';
  }
}

export class EmployeeNumberAlreadyExistsError extends Error {
  constructor(employeeNo: string, companyId: number) {
    super(`EmployeeNumber zaten kullanılıyor (employee_no=${employeeNo}, companyId=${companyId})`);
    this.name = 'EmployeeNumberAlreadyExistsError';
  }
}

export class EmployeeAlreadyLinkedError extends Error {
  constructor(employeeId: number, currentUserId: number) {
    super(
      `Employee (id=${employeeId}) zaten User'a bağlı (userId=${currentUserId}). Önce unlink yap.`,
    );
    this.name = 'EmployeeAlreadyLinkedError';
  }
}

export class UserAlreadyLinkedToEmployeeError extends Error {
  constructor(userId: number, existingEmployeeId: number) {
    super(`User (id=${userId}) başka bir Employee'ye (id=${existingEmployeeId}) zaten bağlı`);
    this.name = 'UserAlreadyLinkedToEmployeeError';
  }
}

export class UserNotFoundForLinkError extends Error {
  constructor(userId: number) {
    super(`Link için aranan User bulunamadı veya aktif değil (id=${userId})`);
    this.name = 'UserNotFoundForLinkError';
  }
}

export class EmployeeAlreadyTerminatedError extends Error {
  constructor(employeeId: number) {
    super(`Employee (id=${employeeId}) zaten terminated durumda`);
    this.name = 'EmployeeAlreadyTerminatedError';
  }
}
