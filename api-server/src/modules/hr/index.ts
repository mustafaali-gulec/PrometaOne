/**
 * HR modülü — Public API.
 *
 * PR 1 (Faz 4): OrgUnit + Department domain + ports + DTO + errors
 * PR 2 (Faz 4): Position + Employee domain + 20 application use-case
 * PR 3 (Faz 4): Recruitment (Candidate + Application) — bu PR
 * PR 4 (Faz 4): Infrastructure + REST routes + DI — gelecek
 *
 * `registerHrModule` henüz YOK — app.ts'e bağlanması PR 4'te.
 *
 * Karar dokümanı: docs/adr/0005-hr-manager-role-and-employee-user-link.md
 * Migration plan: docs/MIGRATION_ROADMAP.md § Faz 4 — HR Core (DETAYLI PLAN)
 */

// ---------------------------------------------------------------------------
// Domain — entities
// ---------------------------------------------------------------------------
export { OrgUnit } from './domain/entities/OrgUnit.js';
export type { OrgUnitProps } from './domain/entities/OrgUnit.js';
export { Department } from './domain/entities/Department.js';
export type { DepartmentProps } from './domain/entities/Department.js';
export { Position } from './domain/entities/Position.js';
export type { PositionProps } from './domain/entities/Position.js';
export { Employee } from './domain/entities/Employee.js';
export type { EmployeeProps } from './domain/entities/Employee.js';
export { Candidate } from './domain/entities/Candidate.js';
export type { CandidateProps } from './domain/entities/Candidate.js';
export { Application } from './domain/entities/Application.js';
export type { ApplicationProps } from './domain/entities/Application.js';

// ---------------------------------------------------------------------------
// Domain — value objects
// ---------------------------------------------------------------------------
export { OrgUnitCode, InvalidOrgUnitCodeError } from './domain/valueObjects/OrgUnitCode.js';
export {
  DepartmentCode,
  InvalidDepartmentCodeError,
} from './domain/valueObjects/DepartmentCode.js';
export {
  ALL_POSITION_STATUSES,
  allowedPositionTransitions,
  InvalidPositionTransitionError,
  isPositionTransitionAllowed,
} from './domain/valueObjects/PositionStatus.js';
export type { PositionStatus } from './domain/valueObjects/PositionStatus.js';
export {
  ALL_EMPLOYEE_STATUSES,
  allowedEmployeeTransitions,
  InvalidEmployeeTransitionError,
  isEmployeeTransitionAllowed,
} from './domain/valueObjects/EmployeeStatus.js';
export type { EmployeeStatus } from './domain/valueObjects/EmployeeStatus.js';
export { ALL_EMPLOYMENT_TYPES, isEmploymentType } from './domain/valueObjects/EmploymentType.js';
export type { EmploymentType } from './domain/valueObjects/EmploymentType.js';
export {
  EmployeeNumber,
  InvalidEmployeeNumberError,
} from './domain/valueObjects/EmployeeNumber.js';
export { TcKimlik, InvalidTcKimlikError } from './domain/valueObjects/TcKimlik.js';
export { PhoneNumber, InvalidPhoneNumberError } from './domain/valueObjects/PhoneNumber.js';
export { HireDate, InvalidHireDateError } from './domain/valueObjects/HireDate.js';
export { ALL_CANDIDATE_SOURCES, isCandidateSource } from './domain/valueObjects/CandidateSource.js';
export type { CandidateSource } from './domain/valueObjects/CandidateSource.js';
export {
  ACTIVE_STAGES,
  allowedStageTransitions,
  ALL_RECRUITMENT_STAGES,
  InvalidStageTransitionError,
  isStageTransitionAllowed,
  isTerminalStage,
  TERMINAL_STAGES,
} from './domain/valueObjects/RecruitmentStage.js';
export type { RecruitmentStage } from './domain/valueObjects/RecruitmentStage.js';

// ---------------------------------------------------------------------------
// Domain — services
// ---------------------------------------------------------------------------
export { OrgTreeBuilder, OrgTreeCycleError } from './domain/services/OrgTreeBuilder.js';
export type { OrgUnitTreeNode } from './domain/services/OrgTreeBuilder.js';
export { SequentialEmployeeNumberGenerator } from './domain/services/EmployeeNumberGenerator.js';
export type { EmployeeNumberGenerator } from './domain/services/EmployeeNumberGenerator.js';
export { ApplicationStageTransitionPolicy } from './domain/services/ApplicationStageTransitionPolicy.js';
export { HireFromApplicationPolicy } from './domain/services/HireFromApplicationPolicy.js';
export type { HireFromApplicationInput as HireFromApplicationPolicyInput } from './domain/services/HireFromApplicationPolicy.js';

// ---------------------------------------------------------------------------
// Application — ports
// ---------------------------------------------------------------------------
export { systemClock } from './application/ports/Clock.js';
export type { Clock } from './application/ports/Clock.js';
export type { AuditLogger, AuditEntry } from './application/ports/AuditLogger.js';
export type { OrgUnitRepository, NewOrgUnitInput } from './application/ports/OrgUnitRepository.js';
export type {
  DepartmentRepository,
  NewDepartmentInput,
} from './application/ports/DepartmentRepository.js';
export type {
  PositionRepository,
  NewPositionInput,
} from './application/ports/PositionRepository.js';
export type {
  EmployeeRepository,
  NewEmployeeInput,
} from './application/ports/EmployeeRepository.js';
export type { UserLookupPort, HrUserSummary } from './application/ports/UserLookupPort.js';
export type {
  CandidateRepository,
  NewCandidateInput,
} from './application/ports/CandidateRepository.js';
export type {
  ApplicationRepository,
  NewApplicationInput,
} from './application/ports/ApplicationRepository.js';
export type {
  ApplicationStageHistoryRepository,
  ApplicationStageHistoryEntry,
  NewApplicationStageHistoryInput,
} from './application/ports/ApplicationStageHistoryRepository.js';

// ---------------------------------------------------------------------------
// Application — DTO
// ---------------------------------------------------------------------------
export { toOrgUnitDto } from './application/dto/OrgUnitDto.js';
export type { OrgUnitDto } from './application/dto/OrgUnitDto.js';
export { toDepartmentDto } from './application/dto/DepartmentDto.js';
export type { DepartmentDto } from './application/dto/DepartmentDto.js';
export { toOrgTreeNodeDto } from './application/dto/OrgTreeNodeDto.js';
export type { OrgTreeNodeDto } from './application/dto/OrgTreeNodeDto.js';
export { toPositionDto } from './application/dto/PositionDto.js';
export type { PositionDto } from './application/dto/PositionDto.js';
export { toEmployeeDto } from './application/dto/EmployeeDto.js';
export type { EmployeeDto } from './application/dto/EmployeeDto.js';
export { toCandidateDto } from './application/dto/CandidateDto.js';
export type { CandidateDto } from './application/dto/CandidateDto.js';
export { toApplicationDto } from './application/dto/ApplicationDto.js';
export type { ApplicationDto, RecruitmentFunnelDto } from './application/dto/ApplicationDto.js';
export { toApplicationStageHistoryDto } from './application/dto/ApplicationStageHistoryDto.js';
export type { ApplicationStageHistoryDto } from './application/dto/ApplicationStageHistoryDto.js';

// ---------------------------------------------------------------------------
// Application — errors
// ---------------------------------------------------------------------------
export {
  OrgUnitNotFoundError,
  OrgCycleDetectedError,
  OrgUnitHasChildrenError,
  OrgUnitCompanyMismatchError,
  DepartmentNotFoundError,
  DepartmentHasActiveEmployeesError,
  DepartmentCompanyMismatchError,
  PositionNotFoundError,
  PositionCompanyMismatchError,
  PositionHasActiveEmployeesError,
  EmployeeNotFoundError,
  EmployeeCompanyMismatchError,
  EmployeeNumberAlreadyExistsError,
  EmployeeAlreadyLinkedError,
  UserAlreadyLinkedToEmployeeError,
  UserNotFoundForLinkError,
  EmployeeAlreadyTerminatedError,
  CandidateNotFoundError,
  CandidateHasActiveApplicationsError,
  ApplicationNotFoundError,
  CandidateAlreadyAppliedToPositionError,
  PositionNotOpenError,
  ApplicationAlreadyTerminalError,
} from './application/errors/HrErrors.js';

// ---------------------------------------------------------------------------
// Application — use-cases (PR 2)
// ---------------------------------------------------------------------------
// OrgUnit
export { CreateOrgUnitUseCase } from './application/useCases/CreateOrgUnitUseCase.js';
export type { CreateOrgUnitInput } from './application/useCases/CreateOrgUnitUseCase.js';
export { UpdateOrgUnitUseCase } from './application/useCases/UpdateOrgUnitUseCase.js';
export type { UpdateOrgUnitInput } from './application/useCases/UpdateOrgUnitUseCase.js';
export { MoveOrgUnitUseCase } from './application/useCases/MoveOrgUnitUseCase.js';
export type { MoveOrgUnitInput } from './application/useCases/MoveOrgUnitUseCase.js';
export { ArchiveOrgUnitUseCase } from './application/useCases/ArchiveOrgUnitUseCase.js';
export type { ArchiveOrgUnitInput } from './application/useCases/ArchiveOrgUnitUseCase.js';
export { ListOrgTreeForCompanyUseCase } from './application/useCases/ListOrgTreeForCompanyUseCase.js';
export type { ListOrgTreeForCompanyInput } from './application/useCases/ListOrgTreeForCompanyUseCase.js';

// Department
export { CreateDepartmentUseCase } from './application/useCases/CreateDepartmentUseCase.js';
export type { CreateDepartmentInput } from './application/useCases/CreateDepartmentUseCase.js';
export { UpdateDepartmentUseCase } from './application/useCases/UpdateDepartmentUseCase.js';
export type { UpdateDepartmentInput } from './application/useCases/UpdateDepartmentUseCase.js';
export { ArchiveDepartmentUseCase } from './application/useCases/ArchiveDepartmentUseCase.js';
export type { ArchiveDepartmentInput } from './application/useCases/ArchiveDepartmentUseCase.js';
export { AssignDepartmentManagerUseCase } from './application/useCases/AssignDepartmentManagerUseCase.js';
export type { AssignDepartmentManagerInput } from './application/useCases/AssignDepartmentManagerUseCase.js';

// Position
export { CreatePositionUseCase } from './application/useCases/CreatePositionUseCase.js';
export type { CreatePositionInput } from './application/useCases/CreatePositionUseCase.js';
export { UpdatePositionUseCase } from './application/useCases/UpdatePositionUseCase.js';
export type { UpdatePositionInput } from './application/useCases/UpdatePositionUseCase.js';
export { ClosePositionUseCase } from './application/useCases/ClosePositionUseCase.js';
export type { ClosePositionInput } from './application/useCases/ClosePositionUseCase.js';
export { ListPositionsUseCase } from './application/useCases/ListPositionsUseCase.js';
export type { ListPositionsInput } from './application/useCases/ListPositionsUseCase.js';

// Employee
export { HireEmployeeUseCase } from './application/useCases/HireEmployeeUseCase.js';
export type { HireEmployeeInput } from './application/useCases/HireEmployeeUseCase.js';
export { UpdateEmployeeProfileUseCase } from './application/useCases/UpdateEmployeeProfileUseCase.js';
export type { UpdateEmployeeProfileInput } from './application/useCases/UpdateEmployeeProfileUseCase.js';
export { TransferEmployeeUseCase } from './application/useCases/TransferEmployeeUseCase.js';
export type { TransferEmployeeInput } from './application/useCases/TransferEmployeeUseCase.js';
export { TerminateEmployeeUseCase } from './application/useCases/TerminateEmployeeUseCase.js';
export type { TerminateEmployeeInput } from './application/useCases/TerminateEmployeeUseCase.js';
export { LinkEmployeeToUserUseCase } from './application/useCases/LinkEmployeeToUserUseCase.js';
export type { LinkEmployeeToUserInput } from './application/useCases/LinkEmployeeToUserUseCase.js';
export { UnlinkEmployeeFromUserUseCase } from './application/useCases/UnlinkEmployeeFromUserUseCase.js';
export type { UnlinkEmployeeFromUserInput } from './application/useCases/UnlinkEmployeeFromUserUseCase.js';
export { ListEmployeesUseCase } from './application/useCases/ListEmployeesUseCase.js';
export type { ListEmployeesInput } from './application/useCases/ListEmployeesUseCase.js';

// Candidate (Recruitment — PR 3)
export { RegisterCandidateUseCase } from './application/useCases/RegisterCandidateUseCase.js';
export type { RegisterCandidateInput } from './application/useCases/RegisterCandidateUseCase.js';
export { UpdateCandidateUseCase } from './application/useCases/UpdateCandidateUseCase.js';
export type { UpdateCandidateInput } from './application/useCases/UpdateCandidateUseCase.js';
export { DeleteCandidateUseCase } from './application/useCases/DeleteCandidateUseCase.js';
export type { DeleteCandidateInput } from './application/useCases/DeleteCandidateUseCase.js';
export { ListCandidatesUseCase } from './application/useCases/ListCandidatesUseCase.js';
export type { ListCandidatesInput } from './application/useCases/ListCandidatesUseCase.js';

// Application (Recruitment — PR 3)
export { SubmitApplicationUseCase } from './application/useCases/SubmitApplicationUseCase.js';
export type { SubmitApplicationInput } from './application/useCases/SubmitApplicationUseCase.js';
export { MoveApplicationStageUseCase } from './application/useCases/MoveApplicationStageUseCase.js';
export type { MoveApplicationStageInput } from './application/useCases/MoveApplicationStageUseCase.js';
export { RejectApplicationUseCase } from './application/useCases/RejectApplicationUseCase.js';
export type { RejectApplicationInput } from './application/useCases/RejectApplicationUseCase.js';
export { WithdrawApplicationUseCase } from './application/useCases/WithdrawApplicationUseCase.js';
export type { WithdrawApplicationInput } from './application/useCases/WithdrawApplicationUseCase.js';
export { HireFromApplicationUseCase } from './application/useCases/HireFromApplicationUseCase.js';
export type { HireFromApplicationInput } from './application/useCases/HireFromApplicationUseCase.js';
export { ListApplicationsForPositionUseCase } from './application/useCases/ListApplicationsForPositionUseCase.js';
export type { ListApplicationsForPositionInput } from './application/useCases/ListApplicationsForPositionUseCase.js';
export { ListApplicationsForCandidateUseCase } from './application/useCases/ListApplicationsForCandidateUseCase.js';
export type { ListApplicationsForCandidateInput } from './application/useCases/ListApplicationsForCandidateUseCase.js';
export { GetRecruitmentFunnelUseCase } from './application/useCases/GetRecruitmentFunnelUseCase.js';
export type { GetRecruitmentFunnelInput } from './application/useCases/GetRecruitmentFunnelUseCase.js';
