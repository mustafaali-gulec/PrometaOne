/**
 * useContracts — bir şirketin sözleşmelerini (proje / taraf filtreli) çeker.
 */
import { useCallback, useEffect, useState } from 'react';

import type { ContractDto, ContractParty } from '../../application/dto/ConstructionDtos';
import type { ConstructionApi } from '../../application/ports/ConstructionApi';

export interface UseContractsOptions {
  projectId?: number;
  partyKind?: ContractParty;
  search?: string;
  autoFetch?: boolean;
}

export interface UseContractsResult {
  contracts: ReadonlyArray<ContractDto>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useContracts(
  api: ConstructionApi,
  companyId: number,
  options: UseContractsOptions = {},
): UseContractsResult {
  const [contracts, setContracts] = useState<ReadonlyArray<ContractDto>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const opts: { projectId?: number; partyKind?: ContractParty; search?: string } = {};
      if (options.projectId !== undefined) opts.projectId = options.projectId;
      if (options.partyKind !== undefined) opts.partyKind = options.partyKind;
      if (options.search !== undefined) opts.search = options.search;
      const res = await api.listContracts(companyId, opts);
      setContracts(res.contracts);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api, companyId, options.projectId, options.partyKind, options.search]);

  useEffect(() => {
    if (options.autoFetch === false) return;
    void refetch();
  }, [refetch, options.autoFetch]);

  return { contracts, loading, error, refetch };
}
