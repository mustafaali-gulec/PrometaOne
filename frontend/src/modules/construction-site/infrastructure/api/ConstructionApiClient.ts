/**
 * ConstructionApiClient — backend /v1/construction endpoint'leri ile konuşan
 * fetch wrapper. request() helper'ı PurchasingApiClient ile aynı (tek text()
 * okuma — happy-dom ReadableStream lock sorununu önler). Bearer token
 * AuthTokenProvider'dan gelir.
 */
import type {
  AdvanceDto,
  AdvancesResponse,
  BoqDto,
  CashMovementDto,
  CashResponse,
  ContractDto,
  ContractParty,
  ContractsResponse,
  ExpenseDto,
  ExpensesResponse,
  MaterialDto,
  MaterialRequestDto,
  MaterialRequestStatus,
  MaterialRequestsResponse,
  MaterialsResponse,
  MovementsResponse,
  PozDto,
  PozResponse,
  ProgressKind,
  ProgressListResponse,
  ProgressPaymentDto,
  ProjectCostSummaryDto,
  ProjectDto,
  ProjectStatus,
  ProjectType,
  ProjectsResponse,
  StockMovementDto,
  StockResponse,
  WarehouseDto,
  WarehousesResponse,
  LaborCostSummaryDto,
  MachineDto,
  MachineLogDto,
  MachineLogsResponse,
  MachinesResponse,
  PersonnelDto,
  PersonnelResponse,
  ProgressCurveDto,
  ProjectDashboardDto,
  TimesheetDto,
  TimesheetsResponse,
} from '../../application/dto/ConstructionDtos';
import type { AuthTokenProvider } from '../../application/ports/AuthTokenProvider';
import type {
  ChangeProgressStatusBody,
  ChangeProjectStatusBody,
  ConstructionApi,
  CreateAdvanceBody,
  CreateCashBody,
  CreateContractBody,
  CreateExpenseBody,
  CreateMachineBody,
  CreateMachineLogBody,
  CreateMaterialBody,
  CreateMaterialRequestBody,
  CreatePersonnelBody,
  CreatePozBody,
  CreateProgressBody,
  CreateProjectBody,
  CreateWarehouseBody,
  RecordMovementBody,
  SaveTimesheetBody,
  SaveBoqBody,
  SaveDeductionsBody,
  SaveProgressLinesBody,
  UpdateContractBody,
  UpdateExpenseBody,
  UpdateMaterialBody,
  UpdatePozBody,
  UpdateProjectBody,
} from '../../application/ports/ConstructionApi';

export class ConstructionApiClient implements ConstructionApi {
  constructor(
    private readonly baseUrl: string,
    private readonly tokens: AuthTokenProvider,
  ) {}

  // ===== PROJECTS ==========================================================
  listProjects(
    companyId: number,
    options?: {
      includeInactive?: boolean;
      status?: ProjectStatus;
      projectType?: ProjectType;
      search?: string;
    },
  ): Promise<ProjectsResponse> {
    const q = new URLSearchParams({ companyId: String(companyId) });
    if (options?.includeInactive !== undefined)
      q.set('includeInactive', String(options.includeInactive));
    if (options?.status !== undefined) q.set('status', options.status);
    if (options?.projectType !== undefined) q.set('projectType', options.projectType);
    if (options?.search !== undefined) q.set('search', options.search);
    return this.request<ProjectsResponse>(`/v1/construction/projects?${q.toString()}`);
  }

  createProject(body: CreateProjectBody): Promise<ProjectDto> {
    return this.request<ProjectDto>(`/v1/construction/projects`, { method: 'POST', body });
  }

  updateProject(id: number, body: UpdateProjectBody): Promise<ProjectDto> {
    return this.request<ProjectDto>(`/v1/construction/projects/${String(id)}`, {
      method: 'PATCH',
      body,
    });
  }

  changeProjectStatus(id: number, body: ChangeProjectStatusBody): Promise<ProjectDto> {
    return this.request<ProjectDto>(`/v1/construction/projects/${String(id)}/status`, {
      method: 'POST',
      body,
    });
  }

  deactivateProject(id: number, companyId: number): Promise<ProjectDto> {
    return this.request<ProjectDto>(
      `/v1/construction/projects/${String(id)}?companyId=${String(companyId)}`,
      { method: 'DELETE' },
    );
  }

  // ===== CONTRACTS =========================================================
  listContracts(
    companyId: number,
    options?: { projectId?: number; partyKind?: ContractParty; search?: string },
  ): Promise<ContractsResponse> {
    const q = new URLSearchParams({ companyId: String(companyId) });
    if (options?.projectId !== undefined) q.set('projectId', String(options.projectId));
    if (options?.partyKind !== undefined) q.set('partyKind', options.partyKind);
    if (options?.search !== undefined) q.set('search', options.search);
    return this.request<ContractsResponse>(`/v1/construction/contracts?${q.toString()}`);
  }

  createContract(body: CreateContractBody): Promise<ContractDto> {
    return this.request<ContractDto>(`/v1/construction/contracts`, { method: 'POST', body });
  }

  updateContract(id: number, body: UpdateContractBody): Promise<ContractDto> {
    return this.request<ContractDto>(`/v1/construction/contracts/${String(id)}`, {
      method: 'PATCH',
      body,
    });
  }

  // ===== POZ CATALOG =======================================================
  listPoz(
    companyId: number,
    options?: { includeInactive?: boolean; search?: string },
  ): Promise<PozResponse> {
    const q = new URLSearchParams({ companyId: String(companyId) });
    if (options?.includeInactive !== undefined)
      q.set('includeInactive', String(options.includeInactive));
    if (options?.search !== undefined) q.set('search', options.search);
    return this.request<PozResponse>(`/v1/construction/poz?${q.toString()}`);
  }

  createPoz(body: CreatePozBody): Promise<PozDto> {
    return this.request<PozDto>(`/v1/construction/poz`, { method: 'POST', body });
  }

  updatePoz(id: number, body: UpdatePozBody): Promise<PozDto> {
    return this.request<PozDto>(`/v1/construction/poz/${String(id)}`, { method: 'PATCH', body });
  }

  deactivatePoz(id: number, companyId: number): Promise<PozDto> {
    return this.request<PozDto>(
      `/v1/construction/poz/${String(id)}?companyId=${String(companyId)}`,
      { method: 'DELETE' },
    );
  }

  // ===== KEŞİF (BoQ) =======================================================
  getBoq(contractId: number, companyId: number): Promise<BoqDto> {
    return this.request<BoqDto>(
      `/v1/construction/contracts/${String(contractId)}/boq?companyId=${String(companyId)}`,
    );
  }

  saveBoq(contractId: number, body: SaveBoqBody): Promise<BoqDto> {
    return this.request<BoqDto>(`/v1/construction/contracts/${String(contractId)}/boq`, {
      method: 'PUT',
      body,
    });
  }

  // ===== HAKEDİŞ ===========================================================
  listProgress(
    companyId: number,
    contractId: number,
    kind?: ProgressKind,
  ): Promise<ProgressListResponse> {
    const q = new URLSearchParams({
      companyId: String(companyId),
      contractId: String(contractId),
    });
    if (kind !== undefined) q.set('kind', kind);
    return this.request<ProgressListResponse>(`/v1/construction/progress?${q.toString()}`);
  }

  getProgress(id: number, companyId: number): Promise<ProgressPaymentDto> {
    return this.request<ProgressPaymentDto>(
      `/v1/construction/progress/${String(id)}?companyId=${String(companyId)}`,
    );
  }

  createProgress(body: CreateProgressBody): Promise<ProgressPaymentDto> {
    return this.request<ProgressPaymentDto>(`/v1/construction/progress`, { method: 'POST', body });
  }

  saveProgressLines(id: number, body: SaveProgressLinesBody): Promise<ProgressPaymentDto> {
    return this.request<ProgressPaymentDto>(`/v1/construction/progress/${String(id)}/lines`, {
      method: 'PUT',
      body,
    });
  }

  saveDeductions(id: number, body: SaveDeductionsBody): Promise<ProgressPaymentDto> {
    return this.request<ProgressPaymentDto>(`/v1/construction/progress/${String(id)}/deductions`, {
      method: 'PUT',
      body,
    });
  }

  changeProgressStatus(id: number, body: ChangeProgressStatusBody): Promise<ProgressPaymentDto> {
    return this.request<ProgressPaymentDto>(`/v1/construction/progress/${String(id)}/status`, {
      method: 'POST',
      body,
    });
  }

  // ===== HARCAMA & FİNANS ==================================================
  listExpenses(companyId: number, projectId: number): Promise<ExpensesResponse> {
    return this.request<ExpensesResponse>(
      `/v1/construction/expenses?companyId=${String(companyId)}&projectId=${String(projectId)}`,
    );
  }
  createExpense(body: CreateExpenseBody): Promise<ExpenseDto> {
    return this.request<ExpenseDto>(`/v1/construction/expenses`, { method: 'POST', body });
  }
  updateExpense(id: number, body: UpdateExpenseBody): Promise<ExpenseDto> {
    return this.request<ExpenseDto>(`/v1/construction/expenses/${String(id)}`, {
      method: 'PATCH',
      body,
    });
  }
  deleteExpense(id: number, companyId: number): Promise<void> {
    return this.request<void>(
      `/v1/construction/expenses/${String(id)}?companyId=${String(companyId)}`,
      { method: 'DELETE' },
    );
  }
  getCostSummary(projectId: number, companyId: number): Promise<ProjectCostSummaryDto> {
    return this.request<ProjectCostSummaryDto>(
      `/v1/construction/projects/${String(projectId)}/cost-summary?companyId=${String(companyId)}`,
    );
  }
  listAdvances(companyId: number, projectId: number): Promise<AdvancesResponse> {
    return this.request<AdvancesResponse>(
      `/v1/construction/advances?companyId=${String(companyId)}&projectId=${String(projectId)}`,
    );
  }
  createAdvance(body: CreateAdvanceBody): Promise<AdvanceDto> {
    return this.request<AdvanceDto>(`/v1/construction/advances`, { method: 'POST', body });
  }
  deleteAdvance(id: number, companyId: number): Promise<void> {
    return this.request<void>(
      `/v1/construction/advances/${String(id)}?companyId=${String(companyId)}`,
      { method: 'DELETE' },
    );
  }
  listCash(companyId: number, projectId: number): Promise<CashResponse> {
    return this.request<CashResponse>(
      `/v1/construction/cash?companyId=${String(companyId)}&projectId=${String(projectId)}`,
    );
  }
  createCash(body: CreateCashBody): Promise<CashMovementDto> {
    return this.request<CashMovementDto>(`/v1/construction/cash`, { method: 'POST', body });
  }
  deleteCash(id: number, companyId: number): Promise<void> {
    return this.request<void>(
      `/v1/construction/cash/${String(id)}?companyId=${String(companyId)}`,
      {
        method: 'DELETE',
      },
    );
  }

  // ===== MALZEME & DEPO ====================================================
  listMaterials(companyId: number, includeInactive?: boolean): Promise<MaterialsResponse> {
    const q = new URLSearchParams({ companyId: String(companyId) });
    if (includeInactive !== undefined) q.set('includeInactive', String(includeInactive));
    return this.request<MaterialsResponse>(`/v1/construction/materials?${q.toString()}`);
  }
  createMaterial(body: CreateMaterialBody): Promise<MaterialDto> {
    return this.request<MaterialDto>(`/v1/construction/materials`, { method: 'POST', body });
  }
  updateMaterial(id: number, body: UpdateMaterialBody): Promise<MaterialDto> {
    return this.request<MaterialDto>(`/v1/construction/materials/${String(id)}`, {
      method: 'PATCH',
      body,
    });
  }
  deactivateMaterial(id: number, companyId: number): Promise<MaterialDto> {
    return this.request<MaterialDto>(
      `/v1/construction/materials/${String(id)}?companyId=${String(companyId)}`,
      { method: 'DELETE' },
    );
  }
  listWarehouses(companyId: number, projectId: number): Promise<WarehousesResponse> {
    return this.request<WarehousesResponse>(
      `/v1/construction/warehouses?companyId=${String(companyId)}&projectId=${String(projectId)}`,
    );
  }
  createWarehouse(body: CreateWarehouseBody): Promise<WarehouseDto> {
    return this.request<WarehouseDto>(`/v1/construction/warehouses`, { method: 'POST', body });
  }
  listStock(companyId: number, projectId: number): Promise<StockResponse> {
    return this.request<StockResponse>(
      `/v1/construction/stock?companyId=${String(companyId)}&projectId=${String(projectId)}`,
    );
  }
  listMovements(companyId: number, projectId: number): Promise<MovementsResponse> {
    return this.request<MovementsResponse>(
      `/v1/construction/stock/movements?companyId=${String(companyId)}&projectId=${String(projectId)}`,
    );
  }
  recordMovement(body: RecordMovementBody): Promise<StockMovementDto> {
    return this.request<StockMovementDto>(`/v1/construction/stock/movements`, {
      method: 'POST',
      body,
    });
  }
  listMaterialRequests(companyId: number, projectId: number): Promise<MaterialRequestsResponse> {
    return this.request<MaterialRequestsResponse>(
      `/v1/construction/material-requests?companyId=${String(companyId)}&projectId=${String(projectId)}`,
    );
  }
  getMaterialRequest(id: number, companyId: number): Promise<MaterialRequestDto> {
    return this.request<MaterialRequestDto>(
      `/v1/construction/material-requests/${String(id)}?companyId=${String(companyId)}`,
    );
  }
  createMaterialRequest(body: CreateMaterialRequestBody): Promise<MaterialRequestDto> {
    return this.request<MaterialRequestDto>(`/v1/construction/material-requests`, {
      method: 'POST',
      body,
    });
  }
  changeMaterialRequestStatus(
    id: number,
    body: { companyId: number; status: MaterialRequestStatus },
  ): Promise<MaterialRequestDto> {
    return this.request<MaterialRequestDto>(
      `/v1/construction/material-requests/${String(id)}/status`,
      { method: 'POST', body },
    );
  }

  // ===== İŞ GÜCÜ & MAKİNE ==================================================
  listPersonnel(companyId: number, projectId: number): Promise<PersonnelResponse> {
    return this.request<PersonnelResponse>(
      `/v1/construction/personnel?companyId=${String(companyId)}&projectId=${String(projectId)}`,
    );
  }
  createPersonnel(body: CreatePersonnelBody): Promise<PersonnelDto> {
    return this.request<PersonnelDto>(`/v1/construction/personnel`, { method: 'POST', body });
  }
  deactivatePersonnel(id: number, companyId: number): Promise<PersonnelDto> {
    return this.request<PersonnelDto>(
      `/v1/construction/personnel/${String(id)}?companyId=${String(companyId)}`,
      { method: 'DELETE' },
    );
  }
  listTimesheets(companyId: number, projectId: number): Promise<TimesheetsResponse> {
    return this.request<TimesheetsResponse>(
      `/v1/construction/timesheets?companyId=${String(companyId)}&projectId=${String(projectId)}`,
    );
  }
  saveTimesheet(body: SaveTimesheetBody): Promise<TimesheetDto> {
    return this.request<TimesheetDto>(`/v1/construction/timesheets`, { method: 'PUT', body });
  }
  listMachines(companyId: number, includeInactive?: boolean): Promise<MachinesResponse> {
    const q = new URLSearchParams({ companyId: String(companyId) });
    if (includeInactive !== undefined) q.set('includeInactive', String(includeInactive));
    return this.request<MachinesResponse>(`/v1/construction/machines?${q.toString()}`);
  }
  createMachine(body: CreateMachineBody): Promise<MachineDto> {
    return this.request<MachineDto>(`/v1/construction/machines`, { method: 'POST', body });
  }
  listMachineLogs(companyId: number, projectId: number): Promise<MachineLogsResponse> {
    return this.request<MachineLogsResponse>(
      `/v1/construction/machine-logs?companyId=${String(companyId)}&projectId=${String(projectId)}`,
    );
  }
  createMachineLog(body: CreateMachineLogBody): Promise<MachineLogDto> {
    return this.request<MachineLogDto>(`/v1/construction/machine-logs`, { method: 'POST', body });
  }
  getLaborCostSummary(projectId: number, companyId: number): Promise<LaborCostSummaryDto> {
    return this.request<LaborCostSummaryDto>(
      `/v1/construction/projects/${String(projectId)}/labor-cost-summary?companyId=${String(companyId)}`,
    );
  }
  getProjectDashboard(projectId: number, companyId: number): Promise<ProjectDashboardDto> {
    return this.request<ProjectDashboardDto>(
      `/v1/construction/projects/${String(projectId)}/dashboard?companyId=${String(companyId)}`,
    );
  }
  getProgressCurve(contractId: number, companyId: number): Promise<ProgressCurveDto> {
    return this.request<ProgressCurveDto>(
      `/v1/construction/contracts/${String(contractId)}/progress-curve?companyId=${String(companyId)}`,
    );
  }

  // ===== Generic request helper ===========================================
  private async request<T>(
    path: string,
    options: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const token = this.tokens.getAccessToken();
    if (token === null || token === '') {
      throw new Error('Auth token yok — önce giriş yapın');
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    let bodyStr: string | undefined;
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      bodyStr = JSON.stringify(options.body);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      ...(bodyStr !== undefined ? { body: bodyStr } : {}),
    });

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    const raw = await response.text();

    if (!response.ok) {
      let message = `HTTP ${String(response.status)}`;
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
}
