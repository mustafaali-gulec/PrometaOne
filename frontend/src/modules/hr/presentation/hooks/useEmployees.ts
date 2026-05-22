/**
 * useEmployees — bir şirketin çalışan listesini çeker (filtre destekli).
 */
import { useCallback, useEffect, useState } from 'react';

import type {
  EmployeeDto,
  EmployeeStatus,
} from '../../application/dto/HrDtos';
import type { HrApi } from '../../application/ports/HrApi';

export interface UseEmployeesOptions {
  status?: EmployeeStatus;
  departmentId?: number;
  positionId?: number;
  q?: string;
  autoFetch?: boolean;
}

export interface UseEmployeesResult {
  employees: ReadonlyArray<EmployeeDto>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useEmployees(
  api: HrApi,
  companyId: number,
  options: UseEmployeesOptions = {},
): UseEmployeesResult {
  const [employees, setEmployees] = useState<ReadonlyArray<EmployeeDto>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const opts: {
        status?: EmployeeStatus;
        departmentId?: number;
        positionId?: number;
        q?: string;
      } = {};
      if (options.status !== undefined) opts.status = options.status;
      if (options.departmentId !== undefined) opts.departmentId = options.departmentId;
      if (options.positionId !== undefined) opts.positionId = options.positionId;
      if (options.q !== undefined) opts.q = options.q;
      const res = await api.listEmployees(companyId, opts);
      setEmployees(res.employees);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [
    api,
    companyId,
    options.status,
    options.departmentId,
    options.positionId,
    options.q,
  ]);

  useEffect(() => {
    if (options.autoFetch === false) return;
    void refetch();
  }, [refetch, options.autoFetch]);

  return { employees, loading, error, refetch };
}
