/**
 * usePozCatalog — bir şirketin poz katalogunu (filtreli) çeker.
 */
import { useCallback, useEffect, useState } from 'react';

import type { PozDto } from '../../application/dto/ConstructionDtos';
import type { ConstructionApi } from '../../application/ports/ConstructionApi';

export interface UsePozCatalogOptions {
  includeInactive?: boolean;
  search?: string;
  autoFetch?: boolean;
}

export interface UsePozCatalogResult {
  poz: ReadonlyArray<PozDto>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePozCatalog(
  api: ConstructionApi,
  companyId: number,
  options: UsePozCatalogOptions = {},
): UsePozCatalogResult {
  const [poz, setPoz] = useState<ReadonlyArray<PozDto>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const opts: { includeInactive?: boolean; search?: string } = {};
      if (options.includeInactive !== undefined) opts.includeInactive = options.includeInactive;
      if (options.search !== undefined) opts.search = options.search;
      const res = await api.listPoz(companyId, opts);
      setPoz(res.poz);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api, companyId, options.includeInactive, options.search]);

  useEffect(() => {
    if (options.autoFetch === false) return;
    void refetch();
  }, [refetch, options.autoFetch]);

  return { poz, loading, error, refetch };
}
