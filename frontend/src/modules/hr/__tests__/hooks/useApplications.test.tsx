/**
 * useApplications hook testleri — positionId/candidateId filter + autoFetch gating.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { applicationsFixture } from '../../../../test/fixtures/hrFixtures';
import { useApplications } from '../../presentation/hooks/useApplications';

import { createFakeHrApi } from './fakeHrApi';

describe('useApplications', () => {
  it('positionId verildiğinde fetch tetiklenir ve data dolar', async () => {
    const api = createFakeHrApi();
    api.listApplications.mockResolvedValueOnce(applicationsFixture);

    const { result } = renderHook(() => useApplications(api, 100, { positionId: 20 }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.applications).toEqual(applicationsFixture.applications);
    });
    expect(api.listApplications).toHaveBeenCalledWith(100, { positionId: 20 });
  });

  it('candidateId filtresi forward edilir', async () => {
    const api = createFakeHrApi();
    api.listApplications.mockResolvedValue(applicationsFixture);

    renderHook(() => useApplications(api, 100, { candidateId: 40, stage: 'screening' }));

    await waitFor(() => {
      expect(api.listApplications).toHaveBeenCalledWith(100, {
        candidateId: 40,
        stage: 'screening',
      });
    });
  });

  it('positionId/candidateId yokken otomatik fetch yapilmaz', async () => {
    const api = createFakeHrApi();
    api.listApplications.mockResolvedValue(applicationsFixture);

    renderHook(() => useApplications(api, 100));

    // Bir tick bekle
    await new Promise((r) => setTimeout(r, 0));

    expect(api.listApplications).not.toHaveBeenCalled();
  });

  it('error state set edilir', async () => {
    const api = createFakeHrApi();
    api.listApplications.mockRejectedValueOnce(new Error('forbidden'));

    const { result } = renderHook(() => useApplications(api, 100, { positionId: 20 }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('forbidden');
    expect(result.current.applications).toEqual([]);
  });
});
