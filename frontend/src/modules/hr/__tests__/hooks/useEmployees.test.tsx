/**
 * useEmployees hook testleri — filter forward + refetch on filter change.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { employeesFixture } from '../../../../test/fixtures/hrFixtures';
import { useEmployees } from '../../presentation/hooks/useEmployees';

import { createFakeHrApi } from './fakeHrApi';

describe('useEmployees', () => {
  it('başarılı yanıt ile employees state dolar', async () => {
    const api = createFakeHrApi();
    api.listEmployees.mockResolvedValueOnce(employeesFixture);

    const { result } = renderHook(() => useEmployees(api, 100));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.employees).toEqual(employeesFixture.employees);
    });
    expect(api.listEmployees).toHaveBeenCalledWith(100, {});
  });

  it('filtre parametreleri (status, departmentId, q) API çağrısına forward edilir', async () => {
    const api = createFakeHrApi();
    api.listEmployees.mockResolvedValue(employeesFixture);

    renderHook(() => useEmployees(api, 100, { status: 'active', departmentId: 10, q: 'Ada' }));

    await waitFor(() => {
      expect(api.listEmployees).toHaveBeenCalledWith(100, {
        status: 'active',
        departmentId: 10,
        q: 'Ada',
      });
    });
  });

  it('filter değişince yeni fetch tetiklenir', async () => {
    const api = createFakeHrApi();
    api.listEmployees.mockResolvedValue(employeesFixture);

    const { rerender } = renderHook(
      ({ status }: { status: 'active' | 'on_leave' }) => useEmployees(api, 100, { status }),
      { initialProps: { status: 'active' } },
    );

    await waitFor(() => {
      expect(api.listEmployees).toHaveBeenCalledTimes(1);
    });

    rerender({ status: 'on_leave' });

    await waitFor(() => {
      expect(api.listEmployees).toHaveBeenCalledTimes(2);
    });

    expect(api.listEmployees).toHaveBeenLastCalledWith(100, { status: 'on_leave' });
  });

  it('error yanıtta error message set edilir', async () => {
    const api = createFakeHrApi();
    api.listEmployees.mockRejectedValueOnce(new Error('forbidden'));

    const { result } = renderHook(() => useEmployees(api, 100));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe('forbidden');
    expect(result.current.employees).toEqual([]);
  });
});
