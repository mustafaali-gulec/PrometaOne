/**
 * useInvoices hook testleri — filter forward + refetch + error.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { invoicesFixture } from '../../../../test/fixtures/financeFixtures';
import { useInvoices } from '../../presentation/hooks/useInvoices';

import { createFakeFinanceApi } from './fakeFinanceApi';

describe('useInvoices', () => {
  it('başarılı yanıt ile invoices state dolar', async () => {
    const api = createFakeFinanceApi();
    api.listInvoices.mockResolvedValueOnce(invoicesFixture);

    const { result } = renderHook(() => useInvoices(api, 100));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.invoices).toEqual(invoicesFixture.invoices);
    });
    expect(api.listInvoices).toHaveBeenCalledWith(100, {});
  });

  it('type + openOnly filtreleri forward edilir', async () => {
    const api = createFakeFinanceApi();
    api.listInvoices.mockResolvedValue(invoicesFixture);

    renderHook(() => useInvoices(api, 100, { type: 'out', openOnly: true }));

    await waitFor(() => {
      expect(api.listInvoices).toHaveBeenCalledWith(100, { type: 'out', openOnly: true });
    });
  });

  it('filter değişince yeni fetch tetiklenir', async () => {
    const api = createFakeFinanceApi();
    api.listInvoices.mockResolvedValue(invoicesFixture);

    const { rerender } = renderHook(
      ({ type }: { type: 'in' | 'out' }) => useInvoices(api, 100, { type }),
      { initialProps: { type: 'in' } },
    );

    await waitFor(() => expect(api.listInvoices).toHaveBeenCalledTimes(1));
    rerender({ type: 'out' });
    await waitFor(() => expect(api.listInvoices).toHaveBeenCalledTimes(2));
    expect(api.listInvoices).toHaveBeenLastCalledWith(100, { type: 'out' });
  });

  it('error yanıtta error message set edilir', async () => {
    const api = createFakeFinanceApi();
    api.listInvoices.mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useInvoices(api, 100));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('boom');
    expect(result.current.invoices).toEqual([]);
  });
});
