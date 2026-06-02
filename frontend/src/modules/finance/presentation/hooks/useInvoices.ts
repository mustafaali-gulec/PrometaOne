/**
 * useInvoices — bir şirketin faturalarını (tip / sadece-açık filtreli) çeker.
 */
import { useCallback, useEffect, useState } from 'react';

import type { FlowDirection, InvoiceDto } from '../../application/dto/FinanceDtos';
import type { FinanceApi } from '../../application/ports/FinanceApi';

export interface UseInvoicesOptions {
  type?: FlowDirection;
  openOnly?: boolean;
  autoFetch?: boolean;
}

export interface UseInvoicesResult {
  invoices: ReadonlyArray<InvoiceDto>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useInvoices(
  api: FinanceApi,
  companyId: number,
  options: UseInvoicesOptions = {},
): UseInvoicesResult {
  const [invoices, setInvoices] = useState<ReadonlyArray<InvoiceDto>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const opts: { type?: FlowDirection; openOnly?: boolean } = {};
      if (options.type !== undefined) opts.type = options.type;
      if (options.openOnly !== undefined) opts.openOnly = options.openOnly;
      const res = await api.listInvoices(companyId, opts);
      setInvoices(res.invoices);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api, companyId, options.type, options.openOnly]);

  useEffect(() => {
    if (options.autoFetch === false) return;
    void refetch();
  }, [refetch, options.autoFetch]);

  return { invoices, loading, error, refetch };
}
