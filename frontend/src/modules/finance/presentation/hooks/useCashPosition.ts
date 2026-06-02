/**
 * useCashPosition — bir banka/kasa hesabının güncel nakit pozisyonunu çeker.
 */
import { useCallback, useEffect, useState } from 'react';

import type { CashPositionDto, EndpointType } from '../../application/dto/FinanceDtos';
import type { FinanceApi } from '../../application/ports/FinanceApi';

export interface UseCashPositionOptions {
  autoFetch?: boolean;
}

export interface UseCashPositionResult {
  position: CashPositionDto | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCashPosition(
  api: FinanceApi,
  companyId: number,
  endpointType: EndpointType,
  accountId: number,
  options: UseCashPositionOptions = {},
): UseCashPositionResult {
  const [position, setPosition] = useState<CashPositionDto | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getCashPosition(companyId, endpointType, accountId);
      setPosition(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api, companyId, endpointType, accountId]);

  useEffect(() => {
    if (options.autoFetch === false) return;
    void refetch();
  }, [refetch, options.autoFetch]);

  return { position, loading, error, refetch };
}
