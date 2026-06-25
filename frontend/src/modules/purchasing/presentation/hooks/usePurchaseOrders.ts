/**
 * usePurchaseOrders — bir şirketin satınalma siparişlerini (durum / tedarikçi
 * filtreli) çeker.
 */
import { useCallback, useEffect, useState } from 'react';

import type { PoStatus, PurchaseOrderDto } from '../../application/dto/PurchasingDtos';
import type { PurchasingApi } from '../../application/ports/PurchasingApi';

export interface UsePurchaseOrdersOptions {
  status?: PoStatus;
  vendorId?: number;
  autoFetch?: boolean;
}

export interface UsePurchaseOrdersResult {
  orders: ReadonlyArray<PurchaseOrderDto>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePurchaseOrders(
  api: PurchasingApi,
  companyId: number,
  options: UsePurchaseOrdersOptions = {},
): UsePurchaseOrdersResult {
  const [orders, setOrders] = useState<ReadonlyArray<PurchaseOrderDto>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const opts: { status?: PoStatus; vendorId?: number } = {};
      if (options.status !== undefined) opts.status = options.status;
      if (options.vendorId !== undefined) opts.vendorId = options.vendorId;
      const res = await api.listOrders(companyId, opts);
      setOrders(res.orders);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api, companyId, options.status, options.vendorId]);

  useEffect(() => {
    if (options.autoFetch === false) return;
    void refetch();
  }, [refetch, options.autoFetch]);

  return { orders, loading, error, refetch };
}
