/**
 * Hook testleri için stub HrApi factory.
 *
 * Sadece test edilen hook'un çağırdığı metod stub'lanır; gerisi
 * "not implemented" fırlatır — yanlışlıkla başka metod çağrılırsa testte
 * net bir hata gözüksün diye.
 *
 * Hook testlerinde gerçek fetch katmanı (HrApiClient + MSW) zorunlu değil:
 * hook'un sözleşmesi HrApi port'u; mock port enjekte ederek odaklı testler
 * yazarız ve fetch katmanı için ayrı HrApiClient.test.ts var.
 *
 * Vitest 3'te `vi.fn<F>(impl)` generic constraint'i çok katı; impl tipiyle
 * `MockedFunction<F>` arasında dönüşüm için cast kullanıyoruz.
 */
import { vi, type MockedFunction } from 'vitest';

import type { HrApi } from '../../application/ports/HrApi';

type HrApiMock = {
  [K in keyof HrApi]: MockedFunction<HrApi[K]>;
};

/**
 * Verilen metod adına `() => never` fırlatan default impl'i olan
 * mocked function üretir. Generic, tüketici tarafında çıkarılır.
 */
function stub<K extends keyof HrApi>(name: K): MockedFunction<HrApi[K]> {
  const fn = vi.fn(() => {
    throw new Error(`fakeHrApi.${String(name)}() çağrıldı ama stub edilmedi`);
  });
  return fn as unknown as MockedFunction<HrApi[K]>;
}

export function createFakeHrApi(): HrApiMock {
  return {
    // OrgUnit
    getOrgTree: stub('getOrgTree'),
    createOrgUnit: stub('createOrgUnit'),
    updateOrgUnit: stub('updateOrgUnit'),
    moveOrgUnit: stub('moveOrgUnit'),
    archiveOrgUnit: stub('archiveOrgUnit'),
    // Department
    createDepartment: stub('createDepartment'),
    updateDepartment: stub('updateDepartment'),
    archiveDepartment: stub('archiveDepartment'),
    assignDepartmentManager: stub('assignDepartmentManager'),
    // Position
    listPositions: stub('listPositions'),
    createPosition: stub('createPosition'),
    updatePosition: stub('updatePosition'),
    closePosition: stub('closePosition'),
    // Employee
    listEmployees: stub('listEmployees'),
    hireEmployee: stub('hireEmployee'),
    updateEmployee: stub('updateEmployee'),
    transferEmployee: stub('transferEmployee'),
    terminateEmployee: stub('terminateEmployee'),
    linkEmployeeToUser: stub('linkEmployeeToUser'),
    unlinkEmployeeFromUser: stub('unlinkEmployeeFromUser'),
    // Candidate
    listCandidates: stub('listCandidates'),
    registerCandidate: stub('registerCandidate'),
    deleteCandidate: stub('deleteCandidate'),
    // Application
    listApplications: stub('listApplications'),
    getRecruitmentFunnel: stub('getRecruitmentFunnel'),
    submitApplication: stub('submitApplication'),
    moveApplicationStage: stub('moveApplicationStage'),
    rejectApplication: stub('rejectApplication'),
    withdrawApplication: stub('withdrawApplication'),
    hireFromApplication: stub('hireFromApplication'),
  };
}

export type { HrApiMock };
