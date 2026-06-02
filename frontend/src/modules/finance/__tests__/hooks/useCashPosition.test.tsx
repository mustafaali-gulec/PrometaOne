/**
 * useCashPosition hook testleri.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { cashPositionFixture } from '../../../../test/fixtures/financeFixtures';
import { useCashPosition } from '../../presentation/hooks/useCashPosition';

import { createFakeFinanceApi } from './fakeFinanceApi';

describe('useCashPosition', () => {
  it('başarılı yanıt ile position state dolar + doğru argümanlar', async () => {
    const api = createFakeFinanceApi();
    api.getCashPosition.mockResolvedValueOnce(cashPositionFixture);

    const { result } = renderHook(() => useCashPosition(api, 100, 'kasa', 1));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.position).toEqual(cashPositionFixture);
    });
    expect(api.getCashPosition).toHaveBeenCalledWith(100, 'kasa', 1);
  });

  it('accountId değişince yeni fetch tetiklenir', async () => {
    const api = createFakeFinanceApi();
    api.getCashPosition.mockResolvedValue(cashPositionFixture);

    const { rerender } = renderHook(
      ({ id }: { id: number }) => useCashPosition(api, 100, 'bank', id),
      { initialProps: { id: 1 } },
    );

    await waitFor(() => expect(api.getCashPosition).toHaveBeenCalledTimes(1));
    rerender({ id: 2 });
    await waitFor(() => expect(api.getCashPosition).toHaveBeenCalledTimes(2));
    expect(api.getCashPosition).toHaveBeenLastCalledWith(100, 'bank', 2);
  });

  it('error yanıtta error set edilir', async () => {
    const api = createFakeFinanceApi();
    api.getCashPosition.mockRejectedValueOnce(new Error('not found'));

    const { result } = renderHook(() => useCashPosition(api, 100, 'kasa', 99));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('not found');
    expect(result.current.position).toBeNull();
  });
});
