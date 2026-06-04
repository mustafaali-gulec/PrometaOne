/**
 * useAssets — bir şirketin varlık havuzunu çeker (filtre destekli).
 */
import { useCallback, useEffect, useState } from 'react';

import type { AssetDto, AssetStatus, AssetType } from '../../application/dto/HrDtos';
import type { HrApi } from '../../application/ports/HrApi';

export interface UseAssetsOptions {
  status?: AssetStatus;
  assignedEmployeeId?: number;
  type?: AssetType;
  autoFetch?: boolean;
}

export interface UseAssetsResult {
  assets: ReadonlyArray<AssetDto>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAssets(
  api: HrApi,
  companyId: number,
  options: UseAssetsOptions = {},
): UseAssetsResult {
  const [assets, setAssets] = useState<ReadonlyArray<AssetDto>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const opts: { status?: AssetStatus; assignedEmployeeId?: number; type?: AssetType } = {};
      if (options.status !== undefined) opts.status = options.status;
      if (options.assignedEmployeeId !== undefined) {
        opts.assignedEmployeeId = options.assignedEmployeeId;
      }
      if (options.type !== undefined) opts.type = options.type;
      const res = await api.listAssets(companyId, opts);
      setAssets(res.assets);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api, companyId, options.status, options.assignedEmployeeId, options.type]);

  useEffect(() => {
    if (options.autoFetch === false) return;
    void refetch();
  }, [refetch, options.autoFetch]);

  return { assets, loading, error, refetch };
}
