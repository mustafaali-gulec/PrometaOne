/**
 * ConstructionApiClient — backend /v1/construction endpoint'leri ile konuşan
 * fetch wrapper. request() helper'ı PurchasingApiClient ile aynı (tek text()
 * okuma — happy-dom ReadableStream lock sorununu önler). Bearer token
 * AuthTokenProvider'dan gelir.
 */
import type {
  ContractDto,
  ContractParty,
  ContractsResponse,
  ProjectDto,
  ProjectStatus,
  ProjectType,
  ProjectsResponse,
} from '../../application/dto/ConstructionDtos';
import type { AuthTokenProvider } from '../../application/ports/AuthTokenProvider';
import type {
  ChangeProjectStatusBody,
  ConstructionApi,
  CreateContractBody,
  CreateProjectBody,
  UpdateContractBody,
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
