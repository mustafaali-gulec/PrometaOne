/**
 * HR frontend modülü — Public API (Faz 4 / PR 5).
 *
 * App.jsx ve diğer modüllere yalnız bu barrel üzerinden açılır.
 */

// ---------------------------------------------------------------------------
// DTO tipleri
// ---------------------------------------------------------------------------
export type {
  ApplicationDto,
  ApplicationsResponse,
  CandidateDto,
  CandidateSource,
  CandidatesResponse,
  DepartmentDto,
  EmployeeDto,
  EmployeeStatus,
  EmployeesResponse,
  EmploymentType,
  OrgTreeNodeDto,
  OrgTreeResponse,
  OrgUnitDto,
  PositionDto,
  PositionStatus,
  PositionsResponse,
  RecruitmentFunnelDto,
  RecruitmentStage,
} from './application/dto/HrDtos';

// ---------------------------------------------------------------------------
// Application — ports
// ---------------------------------------------------------------------------
export type {
  AssignManagerBody,
  CreateDepartmentBody,
  CreateOrgUnitBody,
  CreatePositionBody,
  HireEmployeeBody,
  HireFromApplicationBody,
  HrApi,
  LinkUserBody,
  MoveApplicationStageBody,
  MoveOrgUnitBody,
  RegisterCandidateBody,
  SubmitApplicationBody,
  TerminateEmployeeBody,
  TransferEmployeeBody,
  UpdateDepartmentBody,
  UpdateEmployeeBody,
  UpdateOrgUnitBody,
  UpdatePositionBody,
} from './application/ports/HrApi';
export type { AuthTokenProvider } from './application/ports/AuthTokenProvider';
export { StaticAuthTokenProvider } from './application/ports/AuthTokenProvider';

// ---------------------------------------------------------------------------
// Infrastructure
// ---------------------------------------------------------------------------
export { HrApiClient } from './infrastructure/api/HrApiClient';

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
export { useOrgTree } from './presentation/hooks/useOrgTree';
export type { UseOrgTreeOptions, UseOrgTreeResult } from './presentation/hooks/useOrgTree';
export { useEmployees } from './presentation/hooks/useEmployees';
export type { UseEmployeesOptions, UseEmployeesResult } from './presentation/hooks/useEmployees';
export { usePositions } from './presentation/hooks/usePositions';
export type { UsePositionsOptions, UsePositionsResult } from './presentation/hooks/usePositions';
export { useCandidates } from './presentation/hooks/useCandidates';
export type {
  UseCandidatesOptions,
  UseCandidatesResult,
} from './presentation/hooks/useCandidates';
export { useApplications } from './presentation/hooks/useApplications';
export type {
  UseApplicationsOptions,
  UseApplicationsResult,
} from './presentation/hooks/useApplications';
export { useRecruitmentFunnel } from './presentation/hooks/useRecruitmentFunnel';
export type {
  UseRecruitmentFunnelOptions,
  UseRecruitmentFunnelResult,
} from './presentation/hooks/useRecruitmentFunnel';

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------
export { OrgTreeView } from './presentation/components/OrgTreeView';
export type { OrgTreeViewProps } from './presentation/components/OrgTreeView';
export { EmployeesTable } from './presentation/components/EmployeesTable';
export type { EmployeesTableProps } from './presentation/components/EmployeesTable';
export { PositionsList } from './presentation/components/PositionsList';
export type { PositionsListProps } from './presentation/components/PositionsList';
export { RecruitmentFunnel } from './presentation/components/RecruitmentFunnel';
export type { RecruitmentFunnelProps } from './presentation/components/RecruitmentFunnel';
export { ApplicationKanban } from './presentation/components/ApplicationKanban';
export type { ApplicationKanbanProps } from './presentation/components/ApplicationKanban';
export { CandidateForm } from './presentation/components/CandidateForm';
export type { CandidateFormProps, CandidateFormValues } from './presentation/components/CandidateForm';

// ---------------------------------------------------------------------------
// Demo (test/manuel doğrulama)
// ---------------------------------------------------------------------------
export { HrDemoPage } from './demo/HrDemoPage';
export type { HrDemoPageProps } from './demo/HrDemoPage';
