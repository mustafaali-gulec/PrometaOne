/**
 * useCandidates hook testleri — basic listing + error path.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { candidatesFixture } from '../../../../test/fixtures/hrFixtures';
import { useCandidates } from '../../presentation/hooks/useCandidates';

import { createFakeHrApi } from './fakeHrApi';

describe('useCandidates', () => {
  it('candidates state başarılı yanıtla dolar', async () => {
    const api = createFakeHrApi();
    api.listCandidates.mockResolvedValueOnce(candidatesFixture);

    const { result } = renderHook(() => useCandidates(api, 100));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.candidates).toEqual(candidatesFixture.candidates);
    });
    expect(api.listCandidates).toHaveBeenCalledWith(100, {});
  });

  it('source ve q filtreleri forward edilir', async () => {
    const api = createFakeHrApi();
    api.listCandidates.mockResolvedValue(candidatesFixture);

    renderHook(() => useCandidates(api, 100, { source: 'linkedin', q: 'Ada' }));

    await waitFor(() => {
      expect(api.listCandidates).toHaveBeenCalledWith(100, {
        source: 'linkedin',
        q: 'Ada',
      });
    });
  });

  it('error path: error message set edilir', async () => {
    const api = createFakeHrApi();
    api.listCandidates.mockRejectedValueOnce(new Error('not authorized'));

    const { result } = renderHook(() => useCandidates(api, 100));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('not authorized');
    expect(result.current.candidates).toEqual([]);
  });

  it('non-Error reject String donusumuyle yakalanir', async () => {
    const api = createFakeHrApi();
    api.listCandidates.mockRejectedValueOnce('opaque');

    const { result } = renderHook(() => useCandidates(api, 100));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('opaque');
  });
});
