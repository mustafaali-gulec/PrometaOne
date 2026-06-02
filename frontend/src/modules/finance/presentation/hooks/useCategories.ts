/**
 * useCategories — bir şirketin bütçe kategorilerini (opsiyonel section filtreli)
 * çeker.
 */
import { useCallback, useEffect, useState } from 'react';

import type { CategoryDto, CategorySection } from '../../application/dto/FinanceDtos';
import type { FinanceApi } from '../../application/ports/FinanceApi';

export interface UseCategoriesOptions {
  section?: CategorySection;
  autoFetch?: boolean;
}

export interface UseCategoriesResult {
  categories: ReadonlyArray<CategoryDto>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCategories(
  api: FinanceApi,
  companyId: number,
  options: UseCategoriesOptions = {},
): UseCategoriesResult {
  const [categories, setCategories] = useState<ReadonlyArray<CategoryDto>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listCategories(companyId, options.section);
      setCategories(res.categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api, companyId, options.section]);

  useEffect(() => {
    if (options.autoFetch === false) return;
    void refetch();
  }, [refetch, options.autoFetch]);

  return { categories, loading, error, refetch };
}
