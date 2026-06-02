/**
 * useBudgetMatrix hook testleri.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { budgetMatrixFixture } from '../../../../test/fixtures/financeFixtures';
import { useBudgetMatrix } from '../../presentation/hooks/useBudgetMatrix';

import { createFakeFinanceApi } from './fakeFinanceApi';

describe('useBudgetMatrix', () => {
  it('başarılı yanıt ile matrix state dolar', async () => {
    const api = createFakeFinanceApi();
    api.getBudgetMatrix.mockResolvedValueOnce(budgetMatrixFixture);

    const { result } = renderHook(() => useBudgetMatrix(api, 100, 2026));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.matrix).toEqual(budgetMatrixFixture);
    });
    expect(api.getBudgetMatrix).toHaveBeenCalledWith(100, 2026, undefined);
  });

  it('currency option API çağrısına forward edilir', async () => {
    const api = createFakeFinanceApi();
    api.getBudgetMatrix.mockResolvedValue(budgetMatrixFixture);

    renderHook(() => useBudgetMatrix(api, 100, 2026, { currency: 'USD' }));

    await waitFor(() => {
      expect(api.getBudgetMatrix).toHaveBeenCalledWith(100, 2026, 'USD');
    });
  });

  it('fiscalYear değişince yeni fetch tetiklenir', async () => {
    const api = createFakeFinanceApi();
    api.getBudgetMatrix.mockResolvedValue(budgetMatrixFixture);

    const { rerender } = renderHook(
      ({ year }: { year: number }) => useBudgetMatrix(api, 100, year),
      { initialProps: { year: 2026 } },
    );

    await waitFor(() => expect(api.getBudgetMatrix).toHaveBeenCalledTimes(1));
    rerender({ year: 2027 });
    await waitFor(() => expect(api.getBudgetMatrix).toHaveBeenCalledTimes(2));
    expect(api.getBudgetMatrix).toHaveBeenLastCalledWith(100, 2027, undefined);
  });

  it('error yanıtta error message set edilir', async () => {
    const api = createFakeFinanceApi();
    api.getBudgetMatrix.mockRejectedValueOnce(new Error('forbidden'));

    const { result } = renderHook(() => useBudgetMatrix(api, 100, 2026));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('forbidden');
    expect(result.current.matrix).toBeNull();
  });
});
