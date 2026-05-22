/**
 * useRecruitmentFunnel — pozisyon bazlı (veya tüm) stage huni sayımı.
 *
 * Otomatik refresh edilebilir bir snapshot — kanban'da stage geçişlerinden
 * sonra refetch çağrılır.
 */
import { useCallback, useEffect, useState } from 'react';

import type { RecruitmentFunnelDto } from '../../application/dto/HrDtos';
import type { HrApi } from '../../application/ports/HrApi';

export interface UseRecruitmentFunnelOptions {
  positionId?: number;
  autoFetch?: boolean;
}

export interface UseRecruitmentFunnelResult {
  funnel: RecruitmentFunnelDto | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useRecruitmentFunnel(
  api: HrApi,
  companyId: number,
  options: UseRecruitmentFunnelOptions = {},
): UseRecruitmentFunnelResult {
  const [funnel, setFunnel] = useState<RecruitmentFunnelDto | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getRecruitmentFunnel(companyId, options.positionId);
      setFunnel(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api, companyId, options.positionId]);

  useEffect(() => {
    if (options.autoFetch === false) return;
    void refetch();
  }, [refetch, options.autoFetch]);

  return { funnel, loading, error, refetch };
}
