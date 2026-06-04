/**
 * AccessApiClient — backend /v1/access endpoint'leri ile konuşan fetch wrapper.
 *
 * Auth header AuthTokenProvider'dan alınır (HrApiClient ile aynı pattern).
 * Hata response'ları `{ message: string }` shape'inde; Error.message buradan dolar.
 */
import type {
  CatalogResponse,
  CustomRoleDto,
  EffectivePermissionsDto,
  GrantsResponse,
  OverridesResponse,
  PermissionOverrideDto,
  RoleGrantDto,
  RolesResponse,
} from '../../application/dto/AccessDtos';
import type {
  AccessApi,
  CreateGrantBody,
  CreateRoleBody,
  SetOverrideBody,
  UpdateRoleBody,
} from '../../application/ports/AccessApi';
import type { AuthTokenProvider } from '../../application/ports/AuthTokenProvider';
import type { RefreshFn } from '../auth/RefreshingAuthTokenProvider';

export class AccessApiClient implements AccessApi {
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
  // Catalog
  // -------------------------------------------------------------------------
  getCatalog(): Promise<CatalogResponse> {
    return this.request<CatalogResponse>(`/v1/access/catalog`);
  }

  // -------------------------------------------------------------------------
  // Roles
  // -------------------------------------------------------------------------
  listRoles(companyId: number): Promise<RolesResponse> {
    return this.request<RolesResponse>(`/v1/access/roles?companyId=${companyId}`);
  }

  createRole(body: CreateRoleBody): Promise<CustomRoleDto> {
    return this.request<CustomRoleDto>(`/v1/access/roles`, { method: 'POST', body });
  }

  updateRole(id: number, body: UpdateRoleBody): Promise<CustomRoleDto> {
    return this.request<CustomRoleDto>(`/v1/access/roles/${id}`, { method: 'PUT', body });
  }

  deleteRole(id: number, companyId: number): Promise<void> {
    return this.request<void>(`/v1/access/roles/${id}?companyId=${companyId}`, {
      method: 'DELETE',
    });
  }

  // -------------------------------------------------------------------------
  // Grants
  // -------------------------------------------------------------------------
  listGrants(companyId: number): Promise<GrantsResponse> {
    return this.request<GrantsResponse>(`/v1/access/grants?companyId=${companyId}`);
  }

  createGrant(body: CreateGrantBody): Promise<RoleGrantDto> {
    return this.request<RoleGrantDto>(`/v1/access/grants`, { method: 'POST', body });
  }

  deleteGrant(id: number, companyId: number): Promise<void> {
    return this.request<void>(`/v1/access/grants/${id}?companyId=${companyId}`, {
      method: 'DELETE',
    });
  }

  // -------------------------------------------------------------------------
  // Overrides
  // -------------------------------------------------------------------------
  listOverrides(companyId: number): Promise<OverridesResponse> {
    return this.request<OverridesResponse>(`/v1/access/overrides?companyId=${companyId}`);
  }

  setOverride(body: SetOverrideBody): Promise<PermissionOverrideDto> {
    return this.request<PermissionOverrideDto>(`/v1/access/overrides`, { method: 'PUT', body });
  }

  deleteOverride(id: number, companyId: number): Promise<void> {
    return this.request<void>(`/v1/access/overrides/${id}?companyId=${companyId}`, {
      method: 'DELETE',
    });
  }

  // -------------------------------------------------------------------------
  // Resolve
  // -------------------------------------------------------------------------
  getEffectivePermissions(
    companyId: number,
    options?: { username?: string; role?: string },
  ): Promise<EffectivePermissionsDto> {
    const q = new URLSearchParams({ companyId: String(companyId) });
    if (options?.username !== undefined) q.set('username', options.username);
    if (options?.role !== undefined) q.set('role', options.role);
    return this.request<EffectivePermissionsDto>(
      `/v1/access/effective-permissions?${q.toString()}`,
    );
  }

  // -------------------------------------------------------------------------
  // fetch wrapper
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

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    const raw = await response.text();

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      if (raw.length > 0) {
        try {
          const parsed = JSON.parse(raw) as { message?: string };
          if (parsed.message !== undefined) message = parsed.message;
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
