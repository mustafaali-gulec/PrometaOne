/**
 * useLeaveRequests — bir şirketin izin taleplerini çeker (filtre destekli).
 */
import { useCallback, useEffect, useState } from 'react';

import type { LeaveRequestDto, LeaveStatus } from '../../application/dto/HrDtos';
import type { HrApi } from '../../application/ports/HrApi';

export interface UseLeaveRequestsOptions {
  employeeId?: number;
  status?: LeaveStatus;
  autoFetch?: boolean;
}

export interface UseLeaveRequestsResult {
  leaveRequests: ReadonlyArray<LeaveRequestDto>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useLeaveRequests(
  api: HrApi,
  companyId: number,
  options: UseLeaveRequestsOptions = {},
): UseLeaveRequestsResult {
  const [leaveRequests, setLeaveRequests] = useState<ReadonlyArray<LeaveRequestDto>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const opts: { employeeId?: number; status?: LeaveStatus } = {};
      if (options.employeeId !== undefined) opts.employeeId = options.employeeId;
      if (options.status !== undefined) opts.status = options.status;
      const res = await api.listLeaveRequests(companyId, opts);
      setLeaveRequests(res.leaveRequests);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api, companyId, options.employeeId, options.status]);

  useEffect(() => {
    if (options.autoFetch === false) return;
    void refetch();
  }, [refetch, options.autoFetch]);

  return { leaveRequests, loading, error, refetch };
}
