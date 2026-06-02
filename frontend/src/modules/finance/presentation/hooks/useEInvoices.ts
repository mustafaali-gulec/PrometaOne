/**
 * useEInvoices — şirketin e-fatura cache kayıtlarını çeker (yön/pending filtreli).
 */
import { useCallback, useEffect, useState } from 'react';

import type { EInvoiceDto, InvoiceDirection } from '../../application/dto/EInvoiceDtos';
import type { EInvoiceApi } from '../../application/ports/EInvoiceApi';

export interface UseEInvoicesOptions {
  direction?: InvoiceDirection;
  pendingOnly?: boolean;
  autoFetch?: boolean;
}

export interface UseEInvoicesResult {
  einvoices: ReadonlyArray<EInvoiceDto>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useEInvoices(
  api: EInvoiceApi,
  companyId: number,
  options: UseEInvoicesOptions = {},
): UseEInvoicesResult {
  const [einvoices, setEInvoices] = useState<ReadonlyArray<EInvoiceDto>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const opts: { direction?: InvoiceDirection; pendingOnly?: boolean } = {};
      if (options.direction !== undefined) opts.direction = options.direction;
      if (options.pendingOnly !== undefined) opts.pendingOnly = options.pendingOnly;
      const res = await api.listEInvoices(companyId, opts);
      setEInvoices(res.einvoices);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api, companyId, options.direction, options.pendingOnly]);

  useEffect(() => {
    if (options.autoFetch === false) return;
    void refetch();
  }, [refetch, options.autoFetch]);

  return { einvoices, loading, error, refetch };
}
