/**
 * useApprovalSummaries — bir belge listesinin onay N/M özetlerini TEK istekte
 * çeker (FAZ 5).
 *
 * Belge başına `GET /approvals/doc/...` atmak 50 satırlık bir hakediş listesinde
 * 50 istek demekti; backend bu yüzden toplu uç veriyor. Dönen harita akışı
 * OLMAYAN belgeyi hiç içermez — rozet de o satırda hiçbir şey basmaz.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  ApprovalDocKind,
  ApprovalFlowSummaryDto,
} from '../../application/dto/ConstructionDtos';
import type { ConstructionApi } from '../../application/ports/ConstructionApi';

export interface UseApprovalSummariesResult {
  /** docId → özet. Akışı olmayan belge haritada yoktur. */
  byDocId: ReadonlyMap<number, ApprovalFlowSummaryDto>;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useApprovalSummaries(
  api: ConstructionApi,
  companyId: number,
  docKind: ApprovalDocKind,
  docIds: ReadonlyArray<number>,
): UseApprovalSummariesResult {
  const [byDocId, setByDocId] = useState<ReadonlyMap<number, ApprovalFlowSummaryDto>>(new Map());
  const [error, setError] = useState<string | null>(null);

  /**
   * Kimlik listesi her render'da yeni dizi olarak gelir; sıralı-birleştirilmiş
   * anahtar olmadan effect sonsuz döner.
   */
  const key = useMemo(() => [...docIds].sort((a, b) => a - b).join(','), [docIds]);

  const refetch = useCallback(async (): Promise<void> => {
    const ids = key === '' ? [] : key.split(',').map(Number);
    if (ids.length === 0) {
      setByDocId(new Map());
      return;
    }
    setError(null);
    try {
      const res = await api.getApprovalSummaries(companyId, docKind, ids);
      setByDocId(new Map(res.summaries.map((s) => [s.docId, s])));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [api, companyId, docKind, key]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { byDocId, error, refetch };
}
