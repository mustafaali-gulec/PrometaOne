/**
 * useOrgTree hook testleri — DI ile mocklanan HrApi.
 */
import { act as reactAct, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { orgTreeFixture } from '../../../../test/fixtures/hrFixtures';
import { useOrgTree } from '../../presentation/hooks/useOrgTree';

import { createFakeHrApi } from './fakeHrApi';

const act = reactAct as (callback: () => Promise<void>) => Promise<void>;

describe('useOrgTree', () => {
  it('mount sonrasi başarılı yanıt ile data dolar', async () => {
    const api = createFakeHrApi();
    api.getOrgTree.mockResolvedValueOnce(orgTreeFixture);

    const { result } = renderHook(() => useOrgTree(api, 100));

    // İlk render: state default
    expect(result.current.tree).toEqual([]);
    expect(result.current.error).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.tree).toEqual(orgTreeFixture.tree);
    });

    expect(result.current.error).toBeNull();
    expect(api.getOrgTree).toHaveBeenCalledTimes(1);
    expect(api.getOrgTree).toHaveBeenCalledWith(100, {});
  });

  it('includeInactive option API çağrısına forward edilir', async () => {
    const api = createFakeHrApi();
    api.getOrgTree.mockResolvedValue(orgTreeFixture);

    renderHook(() => useOrgTree(api, 100, { includeInactive: true }));

    await waitFor(() => {
      expect(api.getOrgTree).toHaveBeenCalledWith(100, { includeInactive: true });
    });
  });

  it('error state set edilir, loading false dönder', async () => {
    const api = createFakeHrApi();
    api.getOrgTree.mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useOrgTree(api, 100));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('boom');
    expect(result.current.tree).toEqual([]);
  });

  it('refetch çağrısı yeni fetch tetikler', async () => {
    const api = createFakeHrApi();
    api.getOrgTree.mockResolvedValue(orgTreeFixture);

    const { result } = renderHook(() => useOrgTree(api, 100));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(api.getOrgTree).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetch();
    });

    expect(api.getOrgTree).toHaveBeenCalledTimes(2);
  });

  it('autoFetch=false iken mount’ta fetch yapılmaz', async () => {
    const api = createFakeHrApi();
    api.getOrgTree.mockResolvedValue(orgTreeFixture);

    const { result } = renderHook(() => useOrgTree(api, 100, { autoFetch: false }));

    // Bir tick bekle — fetch hala olmamalı
    await new Promise((r) => setTimeout(r, 0));

    expect(api.getOrgTree).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });
});
