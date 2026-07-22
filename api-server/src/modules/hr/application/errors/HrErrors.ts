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

// ============================================================================
// Candidate (Recruitment — PR 3)
// ============================================================================
export class CandidateNotFoundError extends Error {
  constructor(candidateId: number) {
    super(`Candidate bulunamadı (id=${candidateId})`);
    this.name = 'CandidateNotFoundError';
  }
}

export class CandidateHasActiveApplicationsError extends Error {
  constructor(candidateId: number) {
    super(`Candidate (id=${candidateId}) aktif başvurusu olduğu için silinemez`);
    this.name = 'CandidateHasActiveApplicationsError';
  }
}

// ============================================================================
// Application (Recruitment — PR 3)
// ============================================================================
export class ApplicationNotFoundError extends Error {
  constructor(applicationId: number) {
    super(`Application bulunamadı (id=${applicationId})`);
    this.name = 'ApplicationNotFoundError';
  }
}

export class CandidateAlreadyAppliedToPositionError extends Error {
  constructor(candidateId: number, positionId: number) {
    super(
      `Candidate (id=${candidateId}) bu Position'a (id=${positionId}) zaten aktif başvurusu var`,
    );
    this.name = 'CandidateAlreadyAppliedToPositionError';
  }
}

export class PositionNotOpenError extends Error {
  constructor(positionId: number) {
    super(`Position (id=${positionId}) başvuruya açık değil (status open olmalı)`);
    this.name = 'PositionNotOpenError';
  }
}

export class ApplicationAlreadyTerminalError extends Error {
  constructor(applicationId: number, stage: string) {
    super(
      `Application (id=${applicationId}) zaten terminal stage'de (${stage}), bu işlem uygulanamaz`,
    );
    this.name = 'ApplicationAlreadyTerminalError';
  }
}

// ============================================================================
// LeaveRequest (İzin Yönetimi — Faz B-1)
// ============================================================================
export class LeaveRequestNotFoundError extends Error {
  constructor(leaveRequestId: number) {
    super(`LeaveRequest bulunamadı (id=${leaveRequestId})`);
    this.name = 'LeaveRequestNotFoundError';
  }
}

export class LeaveRequestCompanyMismatchError extends Error {
  constructor(leaveRequestId: number, expectedCompanyId: number) {
    super(
      `LeaveRequest (id=${leaveRequestId}) bu şirkete (companyId=${expectedCompanyId}) ait değil`,
    );
    this.name = 'LeaveRequestCompanyMismatchError';
  }
}

// ============================================================================
// Payroll (Bordro Yönetimi — Faz B-2)
// ============================================================================
export class PayrollRunNotFoundError extends Error {
  constructor(payrollRunId: number) {
    super(`PayrollRun bulunamadı (id=${payrollRunId})`);
    this.name = 'PayrollRunNotFoundError';
  }
}

export class PayrollRunCompanyMismatchError extends Error {
  constructor(payrollRunId: number, expectedCompanyId: number) {
    super(`PayrollRun (id=${payrollRunId}) bu şirkete (companyId=${expectedCompanyId}) ait değil`);
    this.name = 'PayrollRunCompanyMismatchError';
  }
}

export class PayrollRunPeriodAlreadyExistsError extends Error {
  constructor(companyId: number, periodYear: number, periodMonth: number) {
    super(
      `Bu dönem için bordro koşusu zaten var (companyId=${companyId}, ${periodYear}-${String(periodMonth).padStart(2, '0')})`,
    );
    this.name = 'PayrollRunPeriodAlreadyExistsError';
  }
}

export class PayrollRunNotDraftError extends Error {
  constructor(payrollRunId: number) {
    super(`PayrollRun (id=${payrollRunId}) draft değil — bu işlem uygulanamaz`);
    this.name = 'PayrollRunNotDraftError';
  }
}

// ============================================================================
// Asset (Zimmet / Varlık Yönetimi — Faz B-3)
// ============================================================================
export class AssetNotFoundError extends Error {
  constructor(assetId: number) {
    super(`Asset bulunamadı (id=${assetId})`);
    this.name = 'AssetNotFoundError';
  }
}

export class AssetNotAvailableError extends Error {
  constructor(assetId: number) {
    super(`Asset (id=${assetId}) atanabilir değil — in_stock olmalı`);
    this.name = 'AssetNotAvailableError';
  }
}

export class AssetNotAssignedError extends Error {
  constructor(assetId: number) {
    super(`Asset (id=${assetId}) zimmette değil — iade edilemez`);
    this.name = 'AssetNotAssignedError';
  }
}

// ============================================================================
// Org adopt (blob yazma-cutover devralması)
// ============================================================================
export class HrOrgAdoptConflictError extends Error {
  constructor(detail: string) {
    super(`Org devralma benzersizlik çakışması: ${detail}`);
    this.name = 'HrOrgAdoptConflictError';
  }
}

// ============================================================================
// İşe alım adopt (blob yazma-cutover devralması)
// ============================================================================
export class HrRecruitingAdoptConflictError extends Error {
  constructor(detail: string) {
    super(`İşe alım devralma benzersizlik çakışması: ${detail}`);
    this.name = 'HrRecruitingAdoptConflictError';
  }
}
