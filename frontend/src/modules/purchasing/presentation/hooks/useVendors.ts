/**
 * useVendors — bir şirketin tedarikçilerini (arama / pasifler dahil filtreli) çeker.
 */
import { useCallback, useEffect, useState } from 'react';

import type { VendorDto } from '../../application/dto/PurchasingDtos';
import type { PurchasingApi } from '../../application/ports/PurchasingApi';

export interface UseVendorsOptions {
  includeInactive?: boolean;
  search?: string;
  autoFetch?: boolean;
}

export interface UseVendorsResult {
  vendors: ReadonlyArray<VendorDto>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useVendors(
  api: PurchasingApi,
  companyId: number,
  options: UseVendorsOptions = {},
): UseVendorsResult {
  const [vendors, setVendors] = useState<ReadonlyArray<VendorDto>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const opts: { includeInactive?: boolean; search?: string } = {};
      if (options.includeInactive !== undefined) opts.includeInactive = options.includeInactive;
      if (options.search !== undefined) opts.search = options.search;
      const res = await api.listVendors(companyId, opts);
      setVendors(res.vendors);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api, companyId, options.includeInactive, options.search]);

  useEffect(() => {
    if (options.autoFetch === false) return;
    void refetch();
  }, [refetch, options.autoFetch]);

  return { vendors, loading, error, refetch };
}
