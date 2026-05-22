/**
 * usePositions — bir şirketin pozisyon listesini çeker (filtre destekli).
 */
import { useCallback, useEffect, useState } from 'react';

import type {
  PositionDto,
  PositionStatus,
} from '../../application/dto/HrDtos';
import type { HrApi } from '../../application/ports/HrApi';

export interface UsePositionsOptions {
  status?: PositionStatus;
  departmentId?: number | null;
  autoFetch?: boolean;
}

export interface UsePositionsResult {
  positions: ReadonlyArray<PositionDto>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePositions(
  api: HrApi,
  companyId: number,
  options: UsePositionsOptions = {},
): UsePositionsResult {
  const [positions, setPositions] = useState<ReadonlyArray<PositionDto>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const opts: { status?: PositionStatus; departmentId?: number | null } = {};
      if (options.status !== undefined) opts.status = options.status;
      if (options.departmentId !== undefined) opts.departmentId = options.departmentId;
      const res = await api.listPositions(companyId, opts);
      setPositions(res.positions);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api, companyId, options.status, options.departmentId]);

  useEffect(() => {
    if (options.autoFetch === false) return;
    void refetch();
  }, [refetch, options.autoFetch]);

  return { positions, loading, error, refetch };
}
