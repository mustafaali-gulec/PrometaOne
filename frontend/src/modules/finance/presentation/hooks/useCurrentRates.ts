/**
 * useCurrentRates — güncel USD/EUR TCMB kurlarını çeker.
 */
import { useCallback, useEffect, useState } from 'react';

import type { CurrentRatesDto } from '../../application/dto/EInvoiceDtos';
import type { EInvoiceApi } from '../../application/ports/EInvoiceApi';

export interface UseCurrentRatesResult {
  rates: CurrentRatesDto | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCurrentRates(
  api: EInvoiceApi,
  options: { autoFetch?: boolean } = {},
): UseCurrentRatesResult {
  const [rates, setRates] = useState<CurrentRatesDto | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      setRates(await api.getCurrentRates());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (options.autoFetch === false) return;
    void refetch();
  }, [refetch, options.autoFetch]);

  return { rates, loading, error, refetch };
}
