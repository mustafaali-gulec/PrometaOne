/**
 * useRevaluations — şirketin kur farkı değerlemelerini çeker.
 */
import { useCallback, useEffect, useState } from 'react';

import type { RevaluationDto } from '../../application/dto/EInvoiceDtos';
import type { EInvoiceApi } from '../../application/ports/EInvoiceApi';

export interface UseRevaluationsResult {
  revaluations: ReadonlyArray<RevaluationDto>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useRevaluations(
  api: EInvoiceApi,
  companyId: number,
  options: { autoFetch?: boolean } = {},
): UseRevaluationsResult {
  const [revaluations, setRevaluations] = useState<ReadonlyArray<RevaluationDto>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listRevaluations(companyId);
      setRevaluations(res.revaluations);
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

  return { revaluations, loading, error, refetch };
}
