/**
 * useRoleGrants — bir sirketin rol atamalarini (grants) ve rol listesini yukler;
 * grant olusturma/silme aksiyonlarini saglar. useCustomRoles ile ayni pattern.
 */
import { useCallback, useEffect, useState } from 'react';

import type { CustomRoleDto, RoleGrantDto } from '../../application/dto/AccessDtos';
import type { AccessApi, CreateGrantBody } from '../../application/ports/AccessApi';

export interface UseRoleGrantsOptions {
  autoFetch?: boolean;
}

export interface UseRoleGrantsResult {
  grants: ReadonlyArray<RoleGrantDto>;
  roles: ReadonlyArray<CustomRoleDto>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createGrant: (body: CreateGrantBody) => Promise<RoleGrantDto>;
  deleteGrant: (id: number) => Promise<void>;
}

export function useRoleGrants(
  api: AccessApi,
  companyId: number,
  options: UseRoleGrantsOptions = {},
): UseRoleGrantsResult {
  const [grants, setGrants] = useState<ReadonlyArray<RoleGrantDto>>([]);
  const [roles, setRoles] = useState<ReadonlyArray<CustomRoleDto>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [grantsRes, rolesRes] = await Promise.all([
        api.listGrants(companyId),
        api.listRoles(companyId),
      ]);
      setGrants(grantsRes.grants);
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

  const createGrant = useCallback(
    async (body: CreateGrantBody): Promise<RoleGrantDto> => {
      const created = await api.createGrant(body);
      await refetch();
      return created;
    },
    [api, refetch],
  );

  const deleteGrant = useCallback(
    async (id: number): Promise<void> => {
      await api.deleteGrant(id, companyId);
      await refetch();
    },
    [api, companyId, refetch],
  );

  return { grants, roles, loading, error, refetch, createGrant, deleteGrant };
}
