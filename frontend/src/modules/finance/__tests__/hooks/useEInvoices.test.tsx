/**
 * useEInvoices hook testleri.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { einvoicesFixture } from '../../../../test/fixtures/einvoiceFixtures';
import { useEInvoices } from '../../presentation/hooks/useEInvoices';

import { createFakeEInvoiceApi } from './fakeEInvoiceApi';

describe('useEInvoices', () => {
  it('başarılı yanıt ile einvoices state dolar', async () => {
    const api = createFakeEInvoiceApi();
    api.listEInvoices.mockResolvedValueOnce(einvoicesFixture);

    const { result } = renderHook(() => useEInvoices(api, 100));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.einvoices).toEqual(einvoicesFixture.einvoices);
    });
    expect(api.listEInvoices).toHaveBeenCalledWith(100, {});
  });

  it('direction + pendingOnly filtreleri forward edilir', async () => {
    const api = createFakeEInvoiceApi();
    api.listEInvoices.mockResolvedValue(einvoicesFixture);

    renderHook(() => useEInvoices(api, 100, { direction: 'incoming', pendingOnly: true }));

    await waitFor(() => {
      expect(api.listEInvoices).toHaveBeenCalledWith(100, {
        direction: 'incoming',
        pendingOnly: true,
      });
    });
  });

  it('error yanıtta error message set edilir', async () => {
    const api = createFakeEInvoiceApi();
    api.listEInvoices.mockRejectedValueOnce(new Error('forbidden'));

    const { result } = renderHook(() => useEInvoices(api, 100));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('forbidden');
    expect(result.current.einvoices).toEqual([]);
  });
});
