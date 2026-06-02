/**
 * HR modülü — Public API.
 *
 * PR 1 (Faz 4): OrgUnit + Department domain + ports + DTO + errors
 * PR 2 (Faz 4): Position + Employee domain + 20 application use-case
 * PR 3 (Faz 4): Recruitment (Candidate + Application) — bu PR
 * PR 4 (Faz 4): Infrastructure + REST routes + DI — bu PR
 *
 * `registerHrModule` artık var — app.ts içinden çağrılır.
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
export type { HrTransactionalRepositories, UnitOfWork } from './application/ports/UnitOfWork.js';

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

// ---------------------------------------------------------------------------
// Infrastructure (PR 4a)
// ---------------------------------------------------------------------------
export { PgOrgUnitRepository } from './infrastructure/persistence/PgOrgUnitRepository.js';
export { PgDepartmentRepository } from './infrastructure/persistence/PgDepartmentRepository.js';
export { PgPositionRepository } from './infrastructure/persistence/PgPositionRepository.js';
export { PgEmployeeRepository } from './infrastructure/persistence/PgEmployeeRepository.js';
export { PgCandidateRepository } from './infrastructure/persistence/PgCandidateRepository.js';
export { PgApplicationRepository } from './infrastructure/persistence/PgApplicationRepository.js';
export { PgApplicationStageHistoryRepository } from './infrastructure/persistence/PgApplicationStageHistoryRepository.js';
export { PgAuditLogger } from './infrastructure/audit/PgAuditLogger.js';
export { PgEmployeeNumberGenerator } from './infrastructure/sequences/PgEmployeeNumberGenerator.js';
export type { PgEmployeeNumberGeneratorOptions } from './infrastructure/sequences/PgEmployeeNumberGenerator.js';
export { AuthUserLookupAdapter } from './infrastructure/auth/AuthUserLookupAdapter.js';
export { PgUnitOfWork } from './infrastructure/unitOfWork/PgUnitOfWork.js';
export type { Queryable } from './infrastructure/persistence/Queryable.js';

// ---------------------------------------------------------------------------
// Presentation (PR 4b)
// ---------------------------------------------------------------------------
export { createHrRouter } from './presentation/routes.js';
export type { HrRouterDeps } from './presentation/routes.js';
export { mapHrError } from './presentation/errorMapping.js';

// ===========================================================================
// DI Composition — registerHrModule
// ===========================================================================
import type { Hono } from 'hono';
import type { Pool } from 'pg';

import type { UserRepository as AuthUserRepository } from '../auth/index.js';

import { systemClock as _systemClock } from './application/ports/Clock.js';
import { ArchiveDepartmentUseCase as _ArchiveDepartmentUseCase } from './application/useCases/ArchiveDepartmentUseCase.js';
import { ArchiveOrgUnitUseCase as _ArchiveOrgUnitUseCase } from './application/useCases/ArchiveOrgUnitUseCase.js';
import { AssignDepartmentManagerUseCase as _AssignDepartmentManagerUseCase } from './application/useCases/AssignDepartmentManagerUseCase.js';
import { ClosePositionUseCase as _ClosePositionUseCase } from './application/useCases/ClosePositionUseCase.js';
import { CreateDepartmentUseCase as _CreateDepartmentUseCase } from './application/useCases/CreateDepartmentUseCase.js';
import { CreateOrgUnitUseCase as _CreateOrgUnitUseCase } from './application/useCases/CreateOrgUnitUseCase.js';
import { CreatePositionUseCase as _CreatePositionUseCase } from './application/useCases/CreatePositionUseCase.js';
import { DeleteCandidateUseCase as _DeleteCandidateUseCase } from './application/useCases/DeleteCandidateUseCase.js';
import { GetRecruitmentFunnelUseCase as _GetRecruitmentFunnelUseCase } from './application/useCases/GetRecruitmentFunnelUseCase.js';
import { HireEmployeeUseCase as _HireEmployeeUseCase } from './application/useCases/HireEmployeeUseCase.js';
import { HireFromApplicationUseCase as _HireFromApplicationUseCase } from './application/useCases/HireFromApplicationUseCase.js';
import { LinkEmployeeToUserUseCase as _LinkEmployeeToUserUseCase } from './application/useCases/LinkEmployeeToUserUseCase.js';
import { ListApplicationsForCandidateUseCase as _ListApplicationsForCandidateUseCase } from './application/useCases/ListApplicationsForCandidateUseCase.js';
import { ListApplicationsForPositionUseCase as _ListApplicationsForPositionUseCase } from './application/useCases/ListApplicationsForPositionUseCase.js';
import { ListCandidatesUseCase as _ListCandidatesUseCase } from './application/useCases/ListCandidatesUseCase.js';
import { ListEmployeesUseCase as _ListEmployeesUseCase } from './application/useCases/ListEmployeesUseCase.js';
import { ListOrgTreeForCompanyUseCase as _ListOrgTreeForCompanyUseCase } from './application/useCases/ListOrgTreeForCompanyUseCase.js';
import { ListPositionsUseCase as _ListPositionsUseCase } from './application/useCases/ListPositionsUseCase.js';
import { MoveApplicationStageUseCase as _MoveApplicationStageUseCase } from './application/useCases/MoveApplicationStageUseCase.js';
import { MoveOrgUnitUseCase as _MoveOrgUnitUseCase } from './application/useCases/MoveOrgUnitUseCase.js';
import { RegisterCandidateUseCase as _RegisterCandidateUseCase } from './application/useCases/RegisterCandidateUseCase.js';
import { RejectApplicationUseCase as _RejectApplicationUseCase } from './application/useCases/RejectApplicationUseCase.js';
import { SubmitApplicationUseCase as _SubmitApplicationUseCase } from './application/useCases/SubmitApplicationUseCase.js';
import { TerminateEmployeeUseCase as _TerminateEmployeeUseCase } from './application/useCases/TerminateEmployeeUseCase.js';
import { TransferEmployeeUseCase as _TransferEmployeeUseCase } from './application/useCases/TransferEmployeeUseCase.js';
import { UnlinkEmployeeFromUserUseCase as _UnlinkEmployeeFromUserUseCase } from './application/useCases/UnlinkEmployeeFromUserUseCase.js';
import { UpdateCandidateUseCase as _UpdateCandidateUseCase } from './application/useCases/UpdateCandidateUseCase.js';
import { UpdateDepartmentUseCase as _UpdateDepartmentUseCase } from './application/useCases/UpdateDepartmentUseCase.js';
import { UpdateEmployeeProfileUseCase as _UpdateEmployeeProfileUseCase } from './application/useCases/UpdateEmployeeProfileUseCase.js';
import { UpdateOrgUnitUseCase as _UpdateOrgUnitUseCase } from './application/useCases/UpdateOrgUnitUseCase.js';
import { UpdatePositionUseCase as _UpdatePositionUseCase } from './application/useCases/UpdatePositionUseCase.js';
import { WithdrawApplicationUseCase as _WithdrawApplicationUseCase } from './application/useCases/WithdrawApplicationUseCase.js';
import { PgAuditLogger as _PgAuditLogger } from './infrastructure/audit/PgAuditLogger.js';
import { AuthUserLookupAdapter as _AuthUserLookupAdapter } from './infrastructure/auth/AuthUserLookupAdapter.js';
import { PgApplicationRepository as _PgApplicationRepository } from './infrastructure/persistence/PgApplicationRepository.js';
import { PgApplicationStageHistoryRepository as _PgApplicationStageHistoryRepository } from './infrastructure/persistence/PgApplicationStageHistoryRepository.js';
import { PgCandidateRepository as _PgCandidateRepository } from './infrastructure/persistence/PgCandidateRepository.js';
import { PgDepartmentRepository as _PgDepartmentRepository } from './infrastructure/persistence/PgDepartmentRepository.js';
import { PgEmployeeRepository as _PgEmployeeRepository } from './infrastructure/persistence/PgEmployeeRepository.js';
import { PgOrgUnitRepository as _PgOrgUnitRepository } from './infrastructure/persistence/PgOrgUnitRepository.js';
import { PgPositionRepository as _PgPositionRepository } from './infrastructure/persistence/PgPositionRepository.js';
import { PgEmployeeNumberGenerator as _PgEmployeeNumberGenerator } from './infrastructure/sequences/PgEmployeeNumberGenerator.js';
import { PgUnitOfWork as _PgUnitOfWork } from './infrastructure/unitOfWork/PgUnitOfWork.js';
import { createHrRouter as _createHrRouter } from './presentation/routes.js';

export interface HrModuleDeps {
  pool: Pool;
  authUserRepository: AuthUserRepository;
  employeeNumberOptions?: { prefix?: string; width?: number };
}

export interface RegisteredHrModule {
  router: Hono;
}

/**
 * HR modülünü PostgreSQL persistence + REST router'ı ile birlikte hazırlar.
 *
 * Kullanım (app.ts'de):
 *   const hr = registerHrModule({ pool, authUserRepository });
 *   app.route("/v1/hr", hr.router);
 */
export function registerHrModule(deps: HrModuleDeps): RegisteredHrModule {
  const orgUnits = new _PgOrgUnitRepository(deps.pool);
  const employees = new _PgEmployeeRepository(deps.pool);
  const departments = new _PgDepartmentRepository(deps.pool);
  const positions = new _PgPositionRepository(deps.pool);
  const candidates = new _PgCandidateRepository(deps.pool);
  const stageHistory = new _PgApplicationStageHistoryRepository(deps.pool);
  const applications = new _PgApplicationRepository(deps.pool);
  const audit = new _PgAuditLogger(deps.pool);
  const empNoGen = new _PgEmployeeNumberGenerator(deps.pool, deps.employeeNumberOptions ?? {});
  const userLookup = new _AuthUserLookupAdapter(deps.authUserRepository);
  const uow = new _PgUnitOfWork(deps.pool);
  const clock = _systemClock;

  const createOrgUnit = new _CreateOrgUnitUseCase(orgUnits, clock, audit);
  const updateOrgUnit = new _UpdateOrgUnitUseCase(orgUnits, clock, audit);
  const moveOrgUnit = new _MoveOrgUnitUseCase(orgUnits, clock, audit);
  const archiveOrgUnit = new _ArchiveOrgUnitUseCase(orgUnits, clock, audit);
  const listOrgTree = new _ListOrgTreeForCompanyUseCase(orgUnits);

  const createDepartment = new _CreateDepartmentUseCase(departments, orgUnits, clock, audit);
  const updateDepartment = new _UpdateDepartmentUseCase(departments, orgUnits, clock, audit);
  const archiveDepartment = new _ArchiveDepartmentUseCase(departments, clock, audit);
  const assignDepartmentManager = new _AssignDepartmentManagerUseCase(
    departments,
    employees,
    clock,
    audit,
  );

  const createPosition = new _CreatePositionUseCase(positions, departments, clock, audit);
  const updatePosition = new _UpdatePositionUseCase(positions, departments, clock, audit);
  const closePosition = new _ClosePositionUseCase(positions, clock, audit);
  const listPositions = new _ListPositionsUseCase(positions);

  const hireEmployee = new _HireEmployeeUseCase(
    employees,
    departments,
    positions,
    userLookup,
    empNoGen,
    clock,
    audit,
  );
  const updateEmployeeProfile = new _UpdateEmployeeProfileUseCase(employees, clock, audit);
  const transferEmployee = new _TransferEmployeeUseCase(
    employees,
    departments,
    positions,
    clock,
    audit,
  );
  const terminateEmployee = new _TerminateEmployeeUseCase(employees, clock, audit);
  const linkEmployeeToUser = new _LinkEmployeeToUserUseCase(employees, userLookup, clock, audit);
  const unlinkEmployeeFromUser = new _UnlinkEmployeeFromUserUseCase(employees, clock, audit);
  const listEmployees = new _ListEmployeesUseCase(employees);

  const registerCandidate = new _RegisterCandidateUseCase(candidates, clock, audit);
  const updateCandidate = new _UpdateCandidateUseCase(candidates, clock, audit);
  const deleteCandidate = new _DeleteCandidateUseCase(candidates, applications, clock, audit);
  const listCandidates = new _ListCandidatesUseCase(candidates);

  const submitApplication = new _SubmitApplicationUseCase(
    applications,
    candidates,
    positions,
    clock,
    audit,
  );
  const moveApplicationStage = new _MoveApplicationStageUseCase(applications, clock, audit);
  const rejectApplication = new _RejectApplicationUseCase(applications, clock, audit);
  const withdrawApplication = new _WithdrawApplicationUseCase(applications, clock, audit);
  const hireFromApplication = new _HireFromApplicationUseCase(
    uow,
    candidates,
    departments,
    empNoGen,
    clock,
    audit,
  );
  const listApplicationsForPosition = new _ListApplicationsForPositionUseCase(applications);
  const listApplicationsForCandidate = new _ListApplicationsForCandidateUseCase(applications);
  const getRecruitmentFunnel = new _GetRecruitmentFunnelUseCase(applications);

  const router = _createHrRouter({
    createOrgUnit,
    updateOrgUnit,
    moveOrgUnit,
    archiveOrgUnit,
    listOrgTree,
    createDepartment,
    updateDepartment,
    archiveDepartment,
    assignDepartmentManager,
    createPosition,
    updatePosition,
    closePosition,
    listPositions,
    hireEmployee,
    updateEmployeeProfile,
    transferEmployee,
    terminateEmployee,
    linkEmployeeToUser,
    unlinkEmployeeFromUser,
    listEmployees,
    registerCandidate,
    updateCandidate,
    deleteCandidate,
    listCandidates,
    submitApplication,
    moveApplicationStage,
    rejectApplication,
    withdrawApplication,
    hireFromApplication,
    listApplicationsForPosition,
    listApplicationsForCandidate,
    getRecruitmentFunnel,
  });

  void stageHistory;
  return { router };
}
