/**
 * usePayrollRuns — bir şirketin bordro koşularını çeker (filtre destekli).
 */
import { useCallback, useEffect, useState } from 'react';

import type { PayrollRunDto, PayrollRunStatus } from '../../application/dto/HrDtos';
import type { HrApi } from '../../application/ports/HrApi';

export interface UsePayrollRunsOptions {
  year?: number;
  status?: PayrollRunStatus;
  autoFetch?: boolean;
}

export interface UsePayrollRunsResult {
  payrollRuns: ReadonlyArray<PayrollRunDto>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePayrollRuns(
  api: HrApi,
  companyId: number,
  options: UsePayrollRunsOptions = {},
): UsePayrollRunsResult {
  const [payrollRuns, setPayrollRuns] = useState<ReadonlyArray<PayrollRunDto>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const opts: { year?: number; status?: PayrollRunStatus } = {};
      if (options.year !== undefined) opts.year = options.year;
      if (options.status !== undefined) opts.status = options.status;
      const res = await api.listPayrollRuns(companyId, opts);
      setPayrollRuns(res.payrollRuns);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api, companyId, options.year, options.status]);

  useEffect(() => {
    if (options.autoFetch === false) return;
    void refetch();
  }, [refetch, options.autoFetch]);

  return { payrollRuns, loading, error, refetch };
}
