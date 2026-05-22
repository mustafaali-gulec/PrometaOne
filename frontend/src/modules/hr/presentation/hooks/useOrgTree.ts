/**
 * useOrgTree — bir şirketin OrgUnit ağacını çeker.
 *
 * Otomatik fetch (mount + companyId değişiminde). Manual reload için
 * `refetch()` döner. Error/loading state'i basit React state.
 */
import { useCallback, useEffect, useState } from 'react';

import type { OrgTreeNodeDto } from '../../application/dto/HrDtos';
import type { HrApi } from '../../application/ports/HrApi';

export interface UseOrgTreeOptions {
  includeInactive?: boolean;
  /** false verilirse otomatik fetch yapılmaz; sadece refetch ile çekilir. */
  autoFetch?: boolean;
}

export interface UseOrgTreeResult {
  tree: ReadonlyArray<OrgTreeNodeDto>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useOrgTree(
  api: HrApi,
  companyId: number,
  options: UseOrgTreeOptions = {},
): UseOrgTreeResult {
  const [tree, setTree] = useState<ReadonlyArray<OrgTreeNodeDto>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const opts: { includeInactive?: boolean } = {};
      if (options.includeInactive !== undefined) opts.includeInactive = options.includeInactive;
      const res = await api.getOrgTree(companyId, opts);
      setTree(res.tree);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api, companyId, options.includeInactive]);

  useEffect(() => {
    if (options.autoFetch === false) return;
    void refetch();
  }, [refetch, options.autoFetch]);

  return { tree, loading, error, refetch };
}
