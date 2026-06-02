/**
 * useRecruitmentFunnel hook testleri — funnel data parse + refetch.
 */
import { act as reactAct, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { funnelFixture } from '../../../../test/fixtures/hrFixtures';
import { useRecruitmentFunnel } from '../../presentation/hooks/useRecruitmentFunnel';

import { createFakeHrApi } from './fakeHrApi';

const act = reactAct as (callback: () => Promise<void>) => Promise<void>;

describe('useRecruitmentFunnel', () => {
  it('funnel data başarılı yanıtla dolar', async () => {
    const api = createFakeHrApi();
    api.getRecruitmentFunnel.mockResolvedValueOnce(funnelFixture);

    const { result } = renderHook(() => useRecruitmentFunnel(api, 100));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.funnel).toEqual(funnelFixture);
    });
    expect(api.getRecruitmentFunnel).toHaveBeenCalledWith(100, undefined);
  });

  it('positionId option forward edilir', async () => {
    const api = createFakeHrApi();
    api.getRecruitmentFunnel.mockResolvedValue(funnelFixture);

    renderHook(() => useRecruitmentFunnel(api, 100, { positionId: 20 }));

    await waitFor(() => {
      expect(api.getRecruitmentFunnel).toHaveBeenCalledWith(100, 20);
    });
  });

  it('refetch yeniden çağrı yapar', async () => {
    const api = createFakeHrApi();
    api.getRecruitmentFunnel.mockResolvedValue(funnelFixture);

    const { result } = renderHook(() => useRecruitmentFunnel(api, 100));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.refetch();
    });

    expect(api.getRecruitmentFunnel).toHaveBeenCalledTimes(2);
  });

  it('error path: error message set, funnel null kalır', async () => {
    const api = createFakeHrApi();
    api.getRecruitmentFunnel.mockRejectedValueOnce(new Error('500'));

    const { result } = renderHook(() => useRecruitmentFunnel(api, 100));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('500');
    expect(result.current.funnel).toBeNull();
  });
});
