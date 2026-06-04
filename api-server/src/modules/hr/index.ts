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
export { LeaveRequest } from './domain/entities/LeaveRequest.js';
export type { LeaveRequestProps } from './domain/entities/LeaveRequest.js';
export { PayrollRun } from './domain/entities/PayrollRun.js';
export type { PayrollRunProps } from './domain/entities/PayrollRun.js';
export { PayrollItem } from './domain/entities/PayrollItem.js';
export type { PayrollItemProps } from './domain/entities/PayrollItem.js';
export { Asset } from './domain/entities/Asset.js';
export type { AssetProps } from './domain/entities/Asset.js';
export { AssetAssignment } from './domain/entities/AssetAssignment.js';
export type { AssetAssignmentProps } from './domain/entities/AssetAssignment.js';

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
export { ALL_LEAVE_TYPES, isLeaveType } from './domain/valueObjects/LeaveType.js';
export type { LeaveType } from './domain/valueObjects/LeaveType.js';
export {
  ALL_LEAVE_STATUSES,
  allowedLeaveTransitions,
  InvalidLeaveTransitionError,
  isLeaveTransitionAllowed,
  isTerminalLeaveStatus,
  TERMINAL_LEAVE_STATUSES,
} from './domain/valueObjects/LeaveStatus.js';
export type { LeaveStatus } from './domain/valueObjects/LeaveStatus.js';
export {
  ALL_PAYROLL_RUN_STATUSES,
  allowedPayrollRunTransitions,
  InvalidPayrollRunTransitionError,
  isPayrollRunTransitionAllowed,
  isTerminalPayrollRunStatus,
  TERMINAL_PAYROLL_RUN_STATUSES,
} from './domain/valueObjects/PayrollRunStatus.js';
export type { PayrollRunStatus } from './domain/valueObjects/PayrollRunStatus.js';
export { ALL_ASSET_TYPES, isAssetType } from './domain/valueObjects/AssetType.js';
export type { AssetType } from './domain/valueObjects/AssetType.js';
export {
  ALL_ASSET_STATUSES,
  allowedAssetTransitions,
  InvalidAssetTransitionError,
  isAssetTransitionAllowed,
  isTerminalAssetStatus,
  TERMINAL_ASSET_STATUSES,
} from './domain/valueObjects/AssetStatus.js';
export type { AssetStatus } from './domain/valueObjects/AssetStatus.js';

// ---------------------------------------------------------------------------
// Domain — services
// ---------------------------------------------------------------------------
export { OrgTreeBuilder, OrgTreeCycleError } from './domain/services/OrgTreeBuilder.js';
export type { OrgUnitTreeNode } from './domain/services/OrgTreeBuilder.js';
export { SequentialEmployeeNumberGenerator } from './domain/services/EmployeeNumberGenerator.js';
export type { EmployeeNumberGenerator } from './domain/services/EmployeeNumberGenerator.js';
export { LeaveDaysCalculator } from './domain/services/LeaveDaysCalculator.js';
export { PayrollCalculator, TR_PAYROLL_RATES_2026 } from './domain/services/PayrollCalculator.js';
export type {
  IncomeTaxBracket,
  PayrollBreakdown,
  PayrollRates,
} from './domain/services/PayrollCalculator.js';
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
export type {
  LeaveRequestRepository,
  NewLeaveRequestInput,
} from './application/ports/LeaveRequestRepository.js';
export type {
  PayrollRunRepository,
  NewPayrollRunInput,
  NewPayrollItemInput,
} from './application/ports/PayrollRunRepository.js';
export type {
  AssetRepository,
  NewAssetInput,
  NewAssetAssignmentInput,
} from './application/ports/AssetRepository.js';

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
export { toLeaveRequestDto } from './application/dto/LeaveRequestDto.js';
export type { LeaveRequestDto, LeaveBalanceDto } from './application/dto/LeaveRequestDto.js';
export { toPayrollRunDto, toPayrollItemDto } from './application/dto/PayrollRunDto.js';
export type { PayrollRunDto, PayrollItemDto } from './application/dto/PayrollRunDto.js';
export { toAssetDto } from './application/dto/AssetDto.js';
export type { AssetDto } from './application/dto/AssetDto.js';
export { toAssetAssignmentDto } from './application/dto/AssetAssignmentDto.js';
export type { AssetAssignmentDto } from './application/dto/AssetAssignmentDto.js';

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
  LeaveRequestNotFoundError,
  LeaveRequestCompanyMismatchError,
  PayrollRunNotFoundError,
  PayrollRunCompanyMismatchError,
  PayrollRunPeriodAlreadyExistsError,
  PayrollRunNotDraftError,
  AssetNotFoundError,
  AssetNotAvailableError,
  AssetNotAssignedError,
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

// Leave (İzin Yönetimi — Faz B-1)
export { RequestLeaveUseCase } from './application/useCases/RequestLeaveUseCase.js';
export type { RequestLeaveInput } from './application/useCases/RequestLeaveUseCase.js';
export { ApproveLeaveRequestUseCase } from './application/useCases/ApproveLeaveRequestUseCase.js';
export type { ApproveLeaveRequestInput } from './application/useCases/ApproveLeaveRequestUseCase.js';
export { RejectLeaveRequestUseCase } from './application/useCases/RejectLeaveRequestUseCase.js';
export type { RejectLeaveRequestInput } from './application/useCases/RejectLeaveRequestUseCase.js';
export { CancelLeaveRequestUseCase } from './application/useCases/CancelLeaveRequestUseCase.js';
export type { CancelLeaveRequestInput } from './application/useCases/CancelLeaveRequestUseCase.js';
export { ListLeaveRequestsUseCase } from './application/useCases/ListLeaveRequestsUseCase.js';
export type { ListLeaveRequestsInput } from './application/useCases/ListLeaveRequestsUseCase.js';
export {
  GetLeaveBalanceUseCase,
  DEFAULT_ANNUAL_LEAVE_ENTITLEMENT,
} from './application/useCases/GetLeaveBalanceUseCase.js';
export type { GetLeaveBalanceInput } from './application/useCases/GetLeaveBalanceUseCase.js';

// Payroll (Bordro Yönetimi — Faz B-2)
export { CreatePayrollRunUseCase } from './application/useCases/CreatePayrollRunUseCase.js';
export type { CreatePayrollRunInput } from './application/useCases/CreatePayrollRunUseCase.js';
export {
  RunPayrollBatchUseCase,
  DEFAULT_GROSS_SALARY,
} from './application/useCases/RunPayrollBatchUseCase.js';
export type {
  RunPayrollBatchInput,
  RunPayrollBatchResult,
} from './application/useCases/RunPayrollBatchUseCase.js';
export { FinalizePayrollRunUseCase } from './application/useCases/FinalizePayrollRunUseCase.js';
export type { FinalizePayrollRunInput } from './application/useCases/FinalizePayrollRunUseCase.js';
export { ListPayrollRunsUseCase } from './application/useCases/ListPayrollRunsUseCase.js';
export type { ListPayrollRunsInput } from './application/useCases/ListPayrollRunsUseCase.js';
export { GetPayrollRunUseCase } from './application/useCases/GetPayrollRunUseCase.js';
export type {
  GetPayrollRunInput,
  GetPayrollRunResult,
} from './application/useCases/GetPayrollRunUseCase.js';

// Asset (Zimmet / Varlık Yönetimi — Faz B-3)
export { CreateAssetUseCase } from './application/useCases/CreateAssetUseCase.js';
export type { CreateAssetInput } from './application/useCases/CreateAssetUseCase.js';
export { UpdateAssetUseCase } from './application/useCases/UpdateAssetUseCase.js';
export type { UpdateAssetInput } from './application/useCases/UpdateAssetUseCase.js';
export { AssignAssetUseCase } from './application/useCases/AssignAssetUseCase.js';
export type { AssignAssetInput } from './application/useCases/AssignAssetUseCase.js';
export { ReturnAssetUseCase } from './application/useCases/ReturnAssetUseCase.js';
export type { ReturnAssetInput } from './application/useCases/ReturnAssetUseCase.js';
export { ListAssetsUseCase } from './application/useCases/ListAssetsUseCase.js';
export type { ListAssetsInput } from './application/useCases/ListAssetsUseCase.js';
export { GetAssetUseCase } from './application/useCases/GetAssetUseCase.js';
export type { GetAssetInput, GetAssetResult } from './application/useCases/GetAssetUseCase.js';

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
export { PgLeaveRequestRepository } from './infrastructure/persistence/PgLeaveRequestRepository.js';
export { PgPayrollRepository } from './infrastructure/persistence/PgPayrollRepository.js';
export { PgAssetRepository } from './infrastructure/persistence/PgAssetRepository.js';
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
import { ApproveLeaveRequestUseCase as _ApproveLeaveRequestUseCase } from './application/useCases/ApproveLeaveRequestUseCase.js';
import { ArchiveDepartmentUseCase as _ArchiveDepartmentUseCase } from './application/useCases/ArchiveDepartmentUseCase.js';
import { ArchiveOrgUnitUseCase as _ArchiveOrgUnitUseCase } from './application/useCases/ArchiveOrgUnitUseCase.js';
import { AssignAssetUseCase as _AssignAssetUseCase } from './application/useCases/AssignAssetUseCase.js';
import { AssignDepartmentManagerUseCase as _AssignDepartmentManagerUseCase } from './application/useCases/AssignDepartmentManagerUseCase.js';
import { CancelLeaveRequestUseCase as _CancelLeaveRequestUseCase } from './application/useCases/CancelLeaveRequestUseCase.js';
import { ClosePositionUseCase as _ClosePositionUseCase } from './application/useCases/ClosePositionUseCase.js';
import { CreateAssetUseCase as _CreateAssetUseCase } from './application/useCases/CreateAssetUseCase.js';
import { CreateDepartmentUseCase as _CreateDepartmentUseCase } from './application/useCases/CreateDepartmentUseCase.js';
import { CreateOrgUnitUseCase as _CreateOrgUnitUseCase } from './application/useCases/CreateOrgUnitUseCase.js';
import { CreatePayrollRunUseCase as _CreatePayrollRunUseCase } from './application/useCases/CreatePayrollRunUseCase.js';
import { CreatePositionUseCase as _CreatePositionUseCase } from './application/useCases/CreatePositionUseCase.js';
import { DeleteCandidateUseCase as _DeleteCandidateUseCase } from './application/useCases/DeleteCandidateUseCase.js';
import { FinalizePayrollRunUseCase as _FinalizePayrollRunUseCase } from './application/useCases/FinalizePayrollRunUseCase.js';
import { GetAssetUseCase as _GetAssetUseCase } from './application/useCases/GetAssetUseCase.js';
import { GetLeaveBalanceUseCase as _GetLeaveBalanceUseCase } from './application/useCases/GetLeaveBalanceUseCase.js';
import { GetPayrollRunUseCase as _GetPayrollRunUseCase } from './application/useCases/GetPayrollRunUseCase.js';
import { GetRecruitmentFunnelUseCase as _GetRecruitmentFunnelUseCase } from './application/useCases/GetRecruitmentFunnelUseCase.js';
import { HireEmployeeUseCase as _HireEmployeeUseCase } from './application/useCases/HireEmployeeUseCase.js';
import { HireFromApplicationUseCase as _HireFromApplicationUseCase } from './application/useCases/HireFromApplicationUseCase.js';
import { LinkEmployeeToUserUseCase as _LinkEmployeeToUserUseCase } from './application/useCases/LinkEmployeeToUserUseCase.js';
import { ListApplicationsForCandidateUseCase as _ListApplicationsForCandidateUseCase } from './application/useCases/ListApplicationsForCandidateUseCase.js';
import { ListApplicationsForPositionUseCase as _ListApplicationsForPositionUseCase } from './application/useCases/ListApplicationsForPositionUseCase.js';
import { ListAssetsUseCase as _ListAssetsUseCase } from './application/useCases/ListAssetsUseCase.js';
import { ListCandidatesUseCase as _ListCandidatesUseCase } from './application/useCases/ListCandidatesUseCase.js';
import { ListEmployeesUseCase as _ListEmployeesUseCase } from './application/useCases/ListEmployeesUseCase.js';
import { ListLeaveRequestsUseCase as _ListLeaveRequestsUseCase } from './application/useCases/ListLeaveRequestsUseCase.js';
import { ListOrgTreeForCompanyUseCase as _ListOrgTreeForCompanyUseCase } from './application/useCases/ListOrgTreeForCompanyUseCase.js';
import { ListPayrollRunsUseCase as _ListPayrollRunsUseCase } from './application/useCases/ListPayrollRunsUseCase.js';
import { ListPositionsUseCase as _ListPositionsUseCase } from './application/useCases/ListPositionsUseCase.js';
import { MoveApplicationStageUseCase as _MoveApplicationStageUseCase } from './application/useCases/MoveApplicationStageUseCase.js';
import { MoveOrgUnitUseCase as _MoveOrgUnitUseCase } from './application/useCases/MoveOrgUnitUseCase.js';
import { RegisterCandidateUseCase as _RegisterCandidateUseCase } from './application/useCases/RegisterCandidateUseCase.js';
import { RejectApplicationUseCase as _RejectApplicationUseCase } from './application/useCases/RejectApplicationUseCase.js';
import { RejectLeaveRequestUseCase as _RejectLeaveRequestUseCase } from './application/useCases/RejectLeaveRequestUseCase.js';
import { RequestLeaveUseCase as _RequestLeaveUseCase } from './application/useCases/RequestLeaveUseCase.js';
import { ReturnAssetUseCase as _ReturnAssetUseCase } from './application/useCases/ReturnAssetUseCase.js';
import { RunPayrollBatchUseCase as _RunPayrollBatchUseCase } from './application/useCases/RunPayrollBatchUseCase.js';
import { SubmitApplicationUseCase as _SubmitApplicationUseCase } from './application/useCases/SubmitApplicationUseCase.js';
import { TerminateEmployeeUseCase as _TerminateEmployeeUseCase } from './application/useCases/TerminateEmployeeUseCase.js';
import { TransferEmployeeUseCase as _TransferEmployeeUseCase } from './application/useCases/TransferEmployeeUseCase.js';
import { UnlinkEmployeeFromUserUseCase as _UnlinkEmployeeFromUserUseCase } from './application/useCases/UnlinkEmployeeFromUserUseCase.js';
import { UpdateAssetUseCase as _UpdateAssetUseCase } from './application/useCases/UpdateAssetUseCase.js';
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
import { PgAssetRepository as _PgAssetRepository } from './infrastructure/persistence/PgAssetRepository.js';
import { PgCandidateRepository as _PgCandidateRepository } from './infrastructure/persistence/PgCandidateRepository.js';
import { PgDepartmentRepository as _PgDepartmentRepository } from './infrastructure/persistence/PgDepartmentRepository.js';
import { PgEmployeeRepository as _PgEmployeeRepository } from './infrastructure/persistence/PgEmployeeRepository.js';
import { PgLeaveRequestRepository as _PgLeaveRequestRepository } from './infrastructure/persistence/PgLeaveRequestRepository.js';
import { PgOrgUnitRepository as _PgOrgUnitRepository } from './infrastructure/persistence/PgOrgUnitRepository.js';
import { PgPayrollRepository as _PgPayrollRepository } from './infrastructure/persistence/PgPayrollRepository.js';
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
  const leaveRequests = new _PgLeaveRequestRepository(deps.pool);
  const payroll = new _PgPayrollRepository(deps.pool);
  const assets = new _PgAssetRepository(deps.pool);
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

  const requestLeave = new _RequestLeaveUseCase(leaveRequests, employees, clock, audit);
  const approveLeaveRequest = new _ApproveLeaveRequestUseCase(leaveRequests, clock, audit);
  const rejectLeaveRequest = new _RejectLeaveRequestUseCase(leaveRequests, clock, audit);
  const cancelLeaveRequest = new _CancelLeaveRequestUseCase(leaveRequests, clock, audit);
  const listLeaveRequests = new _ListLeaveRequestsUseCase(leaveRequests);
  const getLeaveBalance = new _GetLeaveBalanceUseCase(leaveRequests, employees, clock);

  const createPayrollRun = new _CreatePayrollRunUseCase(payroll, clock, audit);
  const runPayrollBatch = new _RunPayrollBatchUseCase(payroll, employees, positions, clock, audit);
  const finalizePayrollRun = new _FinalizePayrollRunUseCase(payroll, clock, audit);
  const listPayrollRuns = new _ListPayrollRunsUseCase(payroll);
  const getPayrollRun = new _GetPayrollRunUseCase(payroll);

  const createAsset = new _CreateAssetUseCase(assets, clock, audit);
  const updateAsset = new _UpdateAssetUseCase(assets, clock, audit);
  const assignAsset = new _AssignAssetUseCase(assets, employees, clock, audit);
  const returnAsset = new _ReturnAssetUseCase(assets, clock, audit);
  const listAssets = new _ListAssetsUseCase(assets);
  const getAsset = new _GetAssetUseCase(assets);

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
    requestLeave,
    approveLeaveRequest,
    rejectLeaveRequest,
    cancelLeaveRequest,
    listLeaveRequests,
    getLeaveBalance,
    createPayrollRun,
    runPayrollBatch,
    finalizePayrollRun,
    listPayrollRuns,
    getPayrollRun,
    createAsset,
    updateAsset,
    assignAsset,
    returnAsset,
    listAssets,
    getAsset,
  });

  void stageHistory;
  return { router };
}
