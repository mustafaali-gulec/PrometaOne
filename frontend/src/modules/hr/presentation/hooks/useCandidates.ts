/**
 * useCandidates — aday havuzunu çeker (filter: source, q).
 */
import { useCallback, useEffect, useState } from 'react';

import type { CandidateDto, CandidateSource } from '../../application/dto/HrDtos';
import type { HrApi } from '../../application/ports/HrApi';

export interface UseCandidatesOptions {
  source?: CandidateSource;
  q?: string;
  autoFetch?: boolean;
}

export interface UseCandidatesResult {
  candidates: ReadonlyArray<CandidateDto>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCandidates(
  api: HrApi,
  companyId: number,
  options: UseCandidatesOptions = {},
): UseCandidatesResult {
  const [candidates, setCandidates] = useState<ReadonlyArray<CandidateDto>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const opts: { source?: CandidateSource; q?: string } = {};
      if (options.source !== undefined) opts.source = options.source;
      if (options.q !== undefined) opts.q = options.q;
      const res = await api.listCandidates(companyId, opts);
      setCandidates(res.candidates);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api, companyId, options.source, options.q]);

  useEffect(() => {
    if (options.autoFetch === false) return;
    void refetch();
  }, [refetch, options.autoFetch]);

  return { candidates, loading, error, refetch };
}
