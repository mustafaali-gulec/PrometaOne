/**
 * HrApiClient — backend /v1/hr endpoint'leri ile konuşan fetch wrapper.
 *
 * Auth header AuthTokenProvider'dan alınır. Hata response'ları
 * `{ message: string }` shape'ine sahip Hono HTTPException çıktısı;
 * Error.message buradan dolar.
 */
import type { RefreshFn } from '../../../access/infrastructure/auth/RefreshingAuthTokenProvider';
import type {
  ApplicationDto,
  ApplicationsResponse,
  AssetDto,
  AssetsResponse,
  AssetStatus,
  AssetType,
  AssetWithAssignments,
  CandidateDto,
  CandidatesResponse,
  CandidateSource,
  DepartmentDto,
  EmployeeDto,
  EmployeesResponse,
  EmployeeStatus,
  LeaveBalanceDto,
  LeaveRequestDto,
  LeaveRequestsResponse,
  LeaveStatus,
  OrgTreeResponse,
  OrgUnitDto,
  PayrollRunDto,
  PayrollRunsResponse,
  PayrollRunStatus,
  PayrollRunWithItems,
  PositionDto,
  PositionsResponse,
  PositionStatus,
  RecruitmentFunnelDto,
  RecruitmentStage,
} from '../../application/dto/HrDtos';
import type { AuthTokenProvider } from '../../application/ports/AuthTokenProvider';
import type {
  AssignManagerBody,
  CreateAssetBody,
  CreateDepartmentBody,
  CreateOrgUnitBody,
  CreatePositionBody,
  HireEmployeeBody,
  HireFromApplicationBody,
  HrApi,
  LinkUserBody,
  MoveApplicationStageBody,
  MoveOrgUnitBody,
  CreatePayrollRunBody,
  RegisterCandidateBody,
  RequestLeaveBody,
  SubmitApplicationBody,
  TerminateEmployeeBody,
  TransferEmployeeBody,
  UpdateAssetBody,
  UpdateDepartmentBody,
  UpdateEmployeeBody,
  UpdateOrgUnitBody,
  UpdatePositionBody,
} from '../../application/ports/HrApi';

export class HrApiClient implements HrApi {
  /**
   * @param refresh Opsiyonel — 401 alindiginda bir kez cagrilir; yeni access
   *   token doner ve istek tekrarlanir. Yoksa eski (static) davranis.
   */
  constructor(
    private readonly baseUrl: string,
    private readonly tokens: AuthTokenProvider,
    private readonly refresh?: RefreshFn,
  ) {}

  // -------------------------------------------------------------------------
  // OrgUnit
  // -------------------------------------------------------------------------
  getOrgTree(companyId: number, options?: { includeInactive?: boolean }): Promise<OrgTreeResponse> {
    const q = new URLSearchParams({ companyId: String(companyId) });
    if (options?.includeInactive) q.set('includeInactive', 'true');
    return this.request<OrgTreeResponse>(`/v1/hr/org-tree?${q.toString()}`);
  }

  createOrgUnit(body: CreateOrgUnitBody): Promise<OrgUnitDto> {
    return this.request<OrgUnitDto>(`/v1/hr/org-units`, { method: 'POST', body });
  }

  updateOrgUnit(id: number, body: UpdateOrgUnitBody): Promise<OrgUnitDto> {
    return this.request<OrgUnitDto>(`/v1/hr/org-units/${id}`, { method: 'PATCH', body });
  }

  moveOrgUnit(id: number, body: MoveOrgUnitBody): Promise<OrgUnitDto> {
    return this.request<OrgUnitDto>(`/v1/hr/org-units/${id}/move`, { method: 'POST', body });
  }

  archiveOrgUnit(id: number, companyId: number): Promise<OrgUnitDto> {
    return this.request<OrgUnitDto>(`/v1/hr/org-units/${id}?companyId=${companyId}`, {
      method: 'DELETE',
    });
  }

  // -------------------------------------------------------------------------
  // Department
  // -------------------------------------------------------------------------
  createDepartment(body: CreateDepartmentBody): Promise<DepartmentDto> {
    return this.request<DepartmentDto>(`/v1/hr/departments`, { method: 'POST', body });
  }

  updateDepartment(id: number, body: UpdateDepartmentBody): Promise<DepartmentDto> {
    return this.request<DepartmentDto>(`/v1/hr/departments/${id}`, { method: 'PATCH', body });
  }

  archiveDepartment(id: number, companyId: number): Promise<DepartmentDto> {
    return this.request<DepartmentDto>(`/v1/hr/departments/${id}?companyId=${companyId}`, {
      method: 'DELETE',
    });
  }

  assignDepartmentManager(id: number, body: AssignManagerBody): Promise<DepartmentDto> {
    return this.request<DepartmentDto>(`/v1/hr/departments/${id}/assign-manager`, {
      method: 'POST',
      body,
    });
  }

  // -------------------------------------------------------------------------
  // Position
  // -------------------------------------------------------------------------
  listPositions(
    companyId: number,
    options?: { status?: PositionStatus; departmentId?: number | null },
  ): Promise<PositionsResponse> {
    const q = new URLSearchParams({ companyId: String(companyId) });
    if (options?.status !== undefined) q.set('status', options.status);
    if (options?.departmentId !== undefined && options.departmentId !== null) {
      q.set('departmentId', String(options.departmentId));
    }
    return this.request<PositionsResponse>(`/v1/hr/positions?${q.toString()}`);
  }

  createPosition(body: CreatePositionBody): Promise<PositionDto> {
    return this.request<PositionDto>(`/v1/hr/positions`, { method: 'POST', body });
  }

  updatePosition(id: number, body: UpdatePositionBody): Promise<PositionDto> {
    return this.request<PositionDto>(`/v1/hr/positions/${id}`, { method: 'PATCH', body });
  }

  closePosition(id: number, companyId: number): Promise<PositionDto> {
    return this.request<PositionDto>(`/v1/hr/positions/${id}/close`, {
      method: 'POST',
      body: { companyId },
    });
  }

  // -------------------------------------------------------------------------
  // Employee
  // -------------------------------------------------------------------------
  listEmployees(
    companyId: number,
    options?: {
      status?: EmployeeStatus;
      departmentId?: number;
      positionId?: number;
      q?: string;
    },
  ): Promise<EmployeesResponse> {
    const q = new URLSearchParams({ companyId: String(companyId) });
    if (options?.status !== undefined) q.set('status', options.status);
    if (options?.departmentId !== undefined) q.set('departmentId', String(options.departmentId));
    if (options?.positionId !== undefined) q.set('positionId', String(options.positionId));
    if (options?.q !== undefined && options.q.length > 0) q.set('q', options.q);
    return this.request<EmployeesResponse>(`/v1/hr/employees?${q.toString()}`);
  }

  hireEmployee(body: HireEmployeeBody): Promise<EmployeeDto> {
    return this.request<EmployeeDto>(`/v1/hr/employees`, { method: 'POST', body });
  }

  updateEmployee(id: number, body: UpdateEmployeeBody): Promise<EmployeeDto> {
    return this.request<EmployeeDto>(`/v1/hr/employees/${id}`, { method: 'PATCH', body });
  }

  transferEmployee(id: number, body: TransferEmployeeBody): Promise<EmployeeDto> {
    return this.request<EmployeeDto>(`/v1/hr/employees/${id}/transfer`, { method: 'POST', body });
  }

  terminateEmployee(id: number, body: TerminateEmployeeBody): Promise<EmployeeDto> {
    return this.request<EmployeeDto>(`/v1/hr/employees/${id}/terminate`, { method: 'POST', body });
  }

  linkEmployeeToUser(id: number, body: LinkUserBody): Promise<EmployeeDto> {
    return this.request<EmployeeDto>(`/v1/hr/employees/${id}/link-user`, { method: 'POST', body });
  }

  unlinkEmployeeFromUser(id: number, companyId: number): Promise<EmployeeDto> {
    return this.request<EmployeeDto>(`/v1/hr/employees/${id}/link-user?companyId=${companyId}`, {
      method: 'DELETE',
    });
  }

  // -------------------------------------------------------------------------
  // Candidate
  // -------------------------------------------------------------------------
  listCandidates(
    companyId: number,
    options?: { source?: CandidateSource; q?: string },
  ): Promise<CandidatesResponse> {
    const q = new URLSearchParams({ companyId: String(companyId) });
    if (options?.source !== undefined) q.set('source', options.source);
    if (options?.q !== undefined && options.q.length > 0) q.set('q', options.q);
    return this.request<CandidatesResponse>(`/v1/hr/candidates?${q.toString()}`);
  }

  registerCandidate(body: RegisterCandidateBody): Promise<CandidateDto> {
    return this.request<CandidateDto>(`/v1/hr/candidates`, { method: 'POST', body });
  }

  async deleteCandidate(id: number, companyId: number): Promise<void> {
    await this.request<{ ok: boolean }>(`/v1/hr/candidates/${id}?companyId=${companyId}`, {
      method: 'DELETE',
    });
  }

  // -------------------------------------------------------------------------
  // Application
  // -------------------------------------------------------------------------
  listApplications(
    companyId: number,
    options?: { positionId?: number; candidateId?: number; stage?: RecruitmentStage },
  ): Promise<ApplicationsResponse> {
    const q = new URLSearchParams({ companyId: String(companyId) });
    if (options?.positionId !== undefined) q.set('positionId', String(options.positionId));
    if (options?.candidateId !== undefined) q.set('candidateId', String(options.candidateId));
    if (options?.stage !== undefined) q.set('stage', options.stage);
    return this.request<ApplicationsResponse>(`/v1/hr/applications?${q.toString()}`);
  }

  getRecruitmentFunnel(companyId: number, positionId?: number): Promise<RecruitmentFunnelDto> {
    const q = new URLSearchParams({ companyId: String(companyId) });
    if (positionId !== undefined) q.set('positionId', String(positionId));
    return this.request<RecruitmentFunnelDto>(`/v1/hr/applications/funnel?${q.toString()}`);
  }

  submitApplication(body: SubmitApplicationBody): Promise<ApplicationDto> {
    return this.request<ApplicationDto>(`/v1/hr/applications`, { method: 'POST', body });
  }

  moveApplicationStage(id: number, body: MoveApplicationStageBody): Promise<ApplicationDto> {
    return this.request<ApplicationDto>(`/v1/hr/applications/${id}/move-stage`, {
      method: 'POST',
      body,
    });
  }

  rejectApplication(id: number, companyId: number, reason: string): Promise<ApplicationDto> {
    return this.request<ApplicationDto>(`/v1/hr/applications/${id}/reject`, {
      method: 'POST',
      body: { companyId, reason },
    });
  }

  withdrawApplication(id: number, companyId: number, note?: string): Promise<ApplicationDto> {
    return this.request<ApplicationDto>(`/v1/hr/applications/${id}/withdraw`, {
      method: 'POST',
      body: note === undefined ? { companyId } : { companyId, note },
    });
  }

  hireFromApplication(id: number, body: HireFromApplicationBody): Promise<EmployeeDto> {
    return this.request<EmployeeDto>(`/v1/hr/applications/${id}/hire`, { method: 'POST', body });
  }

  // -------------------------------------------------------------------------
  // Leave (İzin)
  // -------------------------------------------------------------------------
  listLeaveRequests(
    companyId: number,
    options?: { employeeId?: number; status?: LeaveStatus },
  ): Promise<LeaveRequestsResponse> {
    const q = new URLSearchParams({ companyId: String(companyId) });
    if (options?.employeeId !== undefined) q.set('employeeId', String(options.employeeId));
    if (options?.status !== undefined) q.set('status', options.status);
    return this.request<LeaveRequestsResponse>(`/v1/hr/leave-requests?${q.toString()}`);
  }

  requestLeave(body: RequestLeaveBody): Promise<LeaveRequestDto> {
    return this.request<LeaveRequestDto>(`/v1/hr/leave-requests`, { method: 'POST', body });
  }

  approveLeave(id: number, companyId: number, note?: string | null): Promise<LeaveRequestDto> {
    return this.request<LeaveRequestDto>(`/v1/hr/leave-requests/${id}/approve`, {
      method: 'POST',
      body: note === undefined ? { companyId } : { companyId, note },
    });
  }

  rejectLeave(id: number, companyId: number, note?: string | null): Promise<LeaveRequestDto> {
    return this.request<LeaveRequestDto>(`/v1/hr/leave-requests/${id}/reject`, {
      method: 'POST',
      body: note === undefined ? { companyId } : { companyId, note },
    });
  }

  cancelLeave(id: number, companyId: number, note?: string | null): Promise<LeaveRequestDto> {
    return this.request<LeaveRequestDto>(`/v1/hr/leave-requests/${id}/cancel`, {
      method: 'POST',
      body: note === undefined ? { companyId } : { companyId, note },
    });
  }

  getLeaveBalance(companyId: number, employeeId: number): Promise<LeaveBalanceDto> {
    const q = new URLSearchParams({
      companyId: String(companyId),
      employeeId: String(employeeId),
    });
    return this.request<LeaveBalanceDto>(`/v1/hr/leave-balance?${q.toString()}`);
  }

  // -------------------------------------------------------------------------
  // Payroll (Bordro)
  // -------------------------------------------------------------------------
  listPayrollRuns(
    companyId: number,
    options?: { year?: number; status?: PayrollRunStatus },
  ): Promise<PayrollRunsResponse> {
    const q = new URLSearchParams({ companyId: String(companyId) });
    if (options?.year !== undefined) q.set('year', String(options.year));
    if (options?.status !== undefined) q.set('status', options.status);
    return this.request<PayrollRunsResponse>(`/v1/hr/payroll-runs?${q.toString()}`);
  }

  createPayrollRun(body: CreatePayrollRunBody): Promise<PayrollRunDto> {
    return this.request<PayrollRunDto>(`/v1/hr/payroll-runs`, { method: 'POST', body });
  }

  runPayrollBatch(id: number, companyId: number): Promise<PayrollRunWithItems> {
    return this.request<PayrollRunWithItems>(`/v1/hr/payroll-runs/${id}/run-batch`, {
      method: 'POST',
      body: { companyId },
    });
  }

  finalizePayrollRun(id: number, companyId: number): Promise<PayrollRunDto> {
    return this.request<PayrollRunDto>(`/v1/hr/payroll-runs/${id}/finalize`, {
      method: 'POST',
      body: { companyId },
    });
  }

  getPayrollRun(id: number, companyId: number): Promise<PayrollRunWithItems> {
    return this.request<PayrollRunWithItems>(`/v1/hr/payroll-runs/${id}?companyId=${companyId}`);
  }

  // -------------------------------------------------------------------------
  // Asset (Zimmet / Varlık Yönetimi)
  // -------------------------------------------------------------------------
  listAssets(
    companyId: number,
    options?: { status?: AssetStatus; assignedEmployeeId?: number; type?: AssetType },
  ): Promise<AssetsResponse> {
    const q = new URLSearchParams({ companyId: String(companyId) });
    if (options?.status !== undefined) q.set('status', options.status);
    if (options?.assignedEmployeeId !== undefined) {
      q.set('assignedEmployeeId', String(options.assignedEmployeeId));
    }
    if (options?.type !== undefined) q.set('type', options.type);
    return this.request<AssetsResponse>(`/v1/hr/assets?${q.toString()}`);
  }

  createAsset(body: CreateAssetBody): Promise<AssetDto> {
    return this.request<AssetDto>(`/v1/hr/assets`, { method: 'POST', body });
  }

  updateAsset(id: number, body: UpdateAssetBody): Promise<AssetDto> {
    return this.request<AssetDto>(`/v1/hr/assets/${id}`, { method: 'PATCH', body });
  }

  assignAsset(id: number, companyId: number, employeeId: number): Promise<AssetDto> {
    return this.request<AssetDto>(`/v1/hr/assets/${id}/assign`, {
      method: 'POST',
      body: { companyId, employeeId },
    });
  }

  returnAsset(id: number, companyId: number, returnNote?: string | null): Promise<AssetDto> {
    return this.request<AssetDto>(`/v1/hr/assets/${id}/return`, {
      method: 'POST',
      body: returnNote === undefined ? { companyId } : { companyId, returnNote },
    });
  }

  getAsset(id: number, companyId: number): Promise<AssetWithAssignments> {
    return this.request<AssetWithAssignments>(`/v1/hr/assets/${id}?companyId=${companyId}`);
  }

  // -------------------------------------------------------------------------
  // Generic request helper
  // -------------------------------------------------------------------------
  private async request<T>(
    path: string,
    options: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const token = this.tokens.getAccessToken();
    if (token === null || token === '') {
      throw new Error('Auth token yok — önce giriş yapın');
    }

    let response = await this.sendOnce(path, options, token);

    // 401 + refresh callback varsa: bir kez yenile ve tekrar dene.
    if (response.status === 401 && this.refresh !== undefined) {
      const newToken = await this.refresh();
      if (newToken !== null && newToken !== '') {
        response = await this.sendOnce(path, options, newToken);
      }
    }

    // happy-dom + bazı fetch implementasyonlarında Response body iki kez
    // okunamaz (ReadableStream lock). Bu yüzden tek seferde text() okuyup
    // sonra parse ediyoruz. Bu hem error hem success path'i tek geçişte
    // halleder.
    if (response.status === 204) {
      return undefined as unknown as T;
    }

    const raw = await response.text();

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      if (raw.length > 0) {
        try {
          const body = JSON.parse(raw) as { message?: string };
          if (body.message !== undefined) message = body.message;
        } catch {
          // raw JSON değil — fallback HTTP status mesajı
        }
      }
      throw new Error(message);
    }

    if (raw.length === 0) {
      return undefined as unknown as T;
    }
    return JSON.parse(raw) as T;
  }

  private sendOnce(
    path: string,
    options: { method?: string; body?: unknown },
    token: string,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    let bodyStr: string | undefined;
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      bodyStr = JSON.stringify(options.body);
    }

    return fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      ...(bodyStr !== undefined ? { body: bodyStr } : {}),
    });
  }
}
