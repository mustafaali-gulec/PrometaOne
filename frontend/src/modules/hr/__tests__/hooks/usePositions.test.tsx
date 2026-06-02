/**
 * usePositions hook testleri — status/departmentId filter + refetch.
 */
import { act as reactAct, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { positionsFixture } from '../../../../test/fixtures/hrFixtures';
import { usePositions } from '../../presentation/hooks/usePositions';

import { createFakeHrApi } from './fakeHrApi';

const act = reactAct as (callback: () => Promise<void>) => Promise<void>;

describe('usePositions', () => {
  it('positions state başarılı yanıtla dolar', async () => {
    const api = createFakeHrApi();
    api.listPositions.mockResolvedValueOnce(positionsFixture);

    const { result } = renderHook(() => usePositions(api, 100));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.positions).toEqual(positionsFixture.positions);
    });
    expect(api.listPositions).toHaveBeenCalledWith(100, {});
  });

  it('status ve departmentId filtreleri forward edilir', async () => {
    const api = createFakeHrApi();
    api.listPositions.mockResolvedValue(positionsFixture);

    renderHook(() => usePositions(api, 100, { status: 'open', departmentId: 10 }));

    await waitFor(() => {
      expect(api.listPositions).toHaveBeenCalledWith(100, {
        status: 'open',
        departmentId: 10,
      });
    });
  });

  it('refetch yeniden fetch tetikler', async () => {
    const api = createFakeHrApi();
    api.listPositions.mockResolvedValue(positionsFixture);

    const { result } = renderHook(() => usePositions(api, 100));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(api.listPositions).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetch();
    });

    expect(api.listPositions).toHaveBeenCalledTimes(2);
  });

  it('error path: error state set + positions boş kalır', async () => {
    const api = createFakeHrApi();
    api.listPositions.mockRejectedValueOnce(new Error('server down'));

    const { result } = renderHook(() => usePositions(api, 100));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('server down');
    expect(result.current.positions).toEqual([]);
  });
});
