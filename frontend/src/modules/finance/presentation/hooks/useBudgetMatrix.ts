/**
 * useBudgetMatrix — bir şirketin mali yıl bütçe matrisini çeker.
 */
import { useCallback, useEffect, useState } from 'react';

import type { BudgetMatrixDto, Currency } from '../../application/dto/FinanceDtos';
import type { FinanceApi } from '../../application/ports/FinanceApi';

export interface UseBudgetMatrixOptions {
  currency?: Currency;
  autoFetch?: boolean;
}

export interface UseBudgetMatrixResult {
  matrix: BudgetMatrixDto | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useBudgetMatrix(
  api: FinanceApi,
  companyId: number,
  fiscalYear: number,
  options: UseBudgetMatrixOptions = {},
): UseBudgetMatrixResult {
  const [matrix, setMatrix] = useState<BudgetMatrixDto | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getBudgetMatrix(companyId, fiscalYear, options.currency);
      setMatrix(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api, companyId, fiscalYear, options.currency]);

  useEffect(() => {
    if (options.autoFetch === false) return;
    void refetch();
  }, [refetch, options.autoFetch]);

  return { matrix, loading, error, refetch };
}
