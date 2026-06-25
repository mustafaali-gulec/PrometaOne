/**
 * usePurchaseRequests — bir şirketin satınalma taleplerini (durum filtreli) çeker.
 */
import { useCallback, useEffect, useState } from 'react';

import type { PrStatus, PurchaseRequestDto } from '../../application/dto/PurchasingDtos';
import type { PurchasingApi } from '../../application/ports/PurchasingApi';

export interface UsePurchaseRequestsOptions {
  status?: PrStatus;
  requesterUserId?: number;
  autoFetch?: boolean;
}

export interface UsePurchaseRequestsResult {
  requests: ReadonlyArray<PurchaseRequestDto>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePurchaseRequests(
  api: PurchasingApi,
  companyId: number,
  options: UsePurchaseRequestsOptions = {},
): UsePurchaseRequestsResult {
  const [requests, setRequests] = useState<ReadonlyArray<PurchaseRequestDto>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const opts: { status?: PrStatus; requesterUserId?: number } = {};
      if (options.status !== undefined) opts.status = options.status;
      if (options.requesterUserId !== undefined) opts.requesterUserId = options.requesterUserId;
      const res = await api.listRequests(companyId, opts);
      setRequests(res.requests);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api, companyId, options.status, options.requesterUserId]);

  useEffect(() => {
    if (options.autoFetch === false) return;
    void refetch();
  }, [refetch, options.autoFetch]);

  return { requests, loading, error, refetch };
}
