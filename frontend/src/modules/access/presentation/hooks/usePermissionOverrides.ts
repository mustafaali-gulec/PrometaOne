/**
 * usePermissionOverrides — bir sirketin kullanici bazli izin override'larini ve
 * izin katalogunu yukler; override upsert/silme aksiyonlarini saglar.
 * useCustomRoles ile ayni pattern.
 */
import { useCallback, useEffect, useState } from 'react';

import type { CatalogResponse, PermissionOverrideDto } from '../../application/dto/AccessDtos';
import type { AccessApi, SetOverrideBody } from '../../application/ports/AccessApi';

export interface UsePermissionOverridesOptions {
  autoFetch?: boolean;
}

export interface UsePermissionOverridesResult {
  overrides: ReadonlyArray<PermissionOverrideDto>;
  catalog: CatalogResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setOverride: (body: SetOverrideBody) => Promise<PermissionOverrideDto>;
  deleteOverride: (id: number) => Promise<void>;
}

export function usePermissionOverrides(
  api: AccessApi,
  companyId: number,
  options: UsePermissionOverridesOptions = {},
): UsePermissionOverridesResult {
  const [overrides, setOverrides] = useState<ReadonlyArray<PermissionOverrideDto>>([]);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [overridesRes, catalogRes] = await Promise.all([
        api.listOverrides(companyId),
        api.getCatalog(),
      ]);
      setOverrides(overridesRes.overrides);
      setCatalog(catalogRes);
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

  const setOverride = useCallback(
    async (body: SetOverrideBody): Promise<PermissionOverrideDto> => {
      const saved = await api.setOverride(body);
      await refetch();
      return saved;
    },
    [api, refetch],
  );

  const deleteOverride = useCallback(
    async (id: number): Promise<void> => {
      await api.deleteOverride(id, companyId);
      await refetch();
    },
    [api, companyId, refetch],
  );

  return { overrides, catalog, loading, error, refetch, setOverride, deleteOverride };
}
