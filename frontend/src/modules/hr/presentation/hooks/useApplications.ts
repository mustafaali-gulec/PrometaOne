/**
 * useApplications — başvuru listesi (positionId veya candidateId ile filter).
 *
 * Backend route'u şu an positionId veya candidateId verilmediyse boş döner —
 * tipik kullanım: belirli bir pozisyonun kanban kolonu için.
 */
import { useCallback, useEffect, useState } from 'react';

import type { ApplicationDto, RecruitmentStage } from '../../application/dto/HrDtos';
import type { HrApi } from '../../application/ports/HrApi';

export interface UseApplicationsOptions {
  positionId?: number;
  candidateId?: number;
  stage?: RecruitmentStage;
  autoFetch?: boolean;
}

export interface UseApplicationsResult {
  applications: ReadonlyArray<ApplicationDto>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useApplications(
  api: HrApi,
  companyId: number,
  options: UseApplicationsOptions = {},
): UseApplicationsResult {
  const [applications, setApplications] = useState<ReadonlyArray<ApplicationDto>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const opts: { positionId?: number; candidateId?: number; stage?: RecruitmentStage } = {};
      if (options.positionId !== undefined) opts.positionId = options.positionId;
      if (options.candidateId !== undefined) opts.candidateId = options.candidateId;
      if (options.stage !== undefined) opts.stage = options.stage;
      const res = await api.listApplications(companyId, opts);
      setApplications(res.applications);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api, companyId, options.positionId, options.candidateId, options.stage]);

  useEffect(() => {
    if (options.autoFetch === false) return;
    // positionId veya candidateId verilmediyse otomatik fetch yapma
    if (options.positionId === undefined && options.candidateId === undefined) return;
    void refetch();
  }, [refetch, options.autoFetch, options.positionId, options.candidateId]);

  return { applications, loading, error, refetch };
}
