/**
 * useCustomRoles — bir şirketin özel rollerini ve izin kataloğunu yükler;
 * rol oluşturma/güncelleme/silme aksiyonlarını sağlar.
 */
import { useCallback, useEffect, useState } from 'react';

import type { CatalogResponse, CustomRoleDto } from '../../application/dto/AccessDtos';
import type { AccessApi, CreateRoleBody, UpdateRoleBody } from '../../application/ports/AccessApi';

export interface UseCustomRolesOptions {
  autoFetch?: boolean;
}

export interface UseCustomRolesResult {
  roles: ReadonlyArray<CustomRoleDto>;
  catalog: CatalogResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createRole: (body: CreateRoleBody) => Promise<CustomRoleDto>;
  updateRole: (id: number, body: UpdateRoleBody) => Promise<CustomRoleDto>;
  deleteRole: (id: number) => Promise<void>;
}

export function useCustomRoles(
  api: AccessApi,
  companyId: number,
  options: UseCustomRolesOptions = {},
): UseCustomRolesResult {
  const [roles, setRoles] = useState<ReadonlyArray<CustomRoleDto>>([]);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [catalogRes, rolesRes] = await Promise.all([
        api.getCatalog(),
        api.listRoles(companyId),
      ]);
      setCatalog(catalogRes);
      setRoles(rolesRes.roles);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api, companyId]);

  useEffect(() => {
    if (options.autoFetch === false) return;
    void refetch();
  }, [refetch, options.autoFetch]);

  const createRole = useCallback(
    async (body: CreateRoleBody): Promise<CustomRoleDto> => {
      const created = await api.createRole(body);
      await refetch();
      return created;
    },
    [api, refetch],
  );

  const updateRole = useCallback(
    async (id: number, body: UpdateRoleBody): Promise<CustomRoleDto> => {
      const updated = await api.updateRole(id, body);
      await refetch();
      return updated;
    },
    [api, refetch],
  );

  const deleteRole = useCallback(
    async (id: number): Promise<void> => {
      await api.deleteRole(id, companyId);
      await refetch();
    },
    [api, companyId, refetch],
  );

  return { roles, catalog, loading, error, refetch, createRole, updateRole, deleteRole };
}
