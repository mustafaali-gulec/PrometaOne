import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Application } from '../../domain/entities/Application.js';
import { Candidate } from '../../domain/entities/Candidate.js';
import { HireFromApplicationPolicy } from '../../domain/services/HireFromApplicationPolicy.js';
import { PhoneNumber } from '../../domain/valueObjects/PhoneNumber.js';

const DATE = new Date('2026-05-21T09:00:00Z');

function makeCandidate(overrides: Record<string, unknown> = {}): Candidate {
  return Candidate.create({
    id: 50,
    companyId: 100,
    firstName: 'Ayşe',
    lastName: 'Demir',
    email: 'ayse@example.com',
    phone: PhoneNumber.create('05321234567'),
    source: 'linkedin',
    cvUrl: null,
    notes: null,
    createdAt: DATE,
    updatedAt: DATE,
    ...overrides,
  } as never);
}

function makeApp(overrides: Record<string, unknown> = {}): Application {
  return Application.create({
    id: 7,
    companyId: 100,
    candidateId: 50,
    positionId: 99,
    stage: 'offer',
    stageChangedAt: DATE,
    stageChangedBy: 1,
    rejectionReason: null,
    salaryExpectation: 60000,
    notes: null,
    createdAt: DATE,
    updatedAt: DATE,
    ...overrides,
  } as never);
}

describe('HireFromApplicationPolicy.toNewEmployeeInput', () => {
  it('happy: temel field mapping', () => {
    const c = makeCandidate();
    const a = makeApp();

    const input = HireFromApplicationPolicy.toNewEmployeeInput({
      candidate: c,
      application: a,
      departmentId: 10,
      employeeNo: 'EMP-000001',
      hireDate: '2026-06-01',
    });

    assert.equal(input.companyId, 100);
    assert.equal(input.firstName, 'Ayşe');
    assert.equal(input.lastName, 'Demir');
    assert.equal(input.email, 'ayse@example.com');
    assert.equal(input.phone, '+905321234567');
    assert.equal(input.positionId, 99);
    assert.equal(input.departmentId, 10);
    assert.equal(input.employeeNo, 'EMP-000001');
    assert.equal(input.hireDate, '2026-06-01');
    assert.equal(input.status, 'probation');
    assert.equal(input.employmentType, 'full_time');
    assert.equal(input.sourceApplicationId, 7);
    assert.equal(input.userId, null);
    assert.equal(input.tcKimlik, null);
  });

  it("opsiyonel field'lar override edilebilir", () => {
    const c = makeCandidate();
    const a = makeApp();
    const input = HireFromApplicationPolicy.toNewEmployeeInput({
      candidate: c,
      application: a,
      departmentId: 10,
      employeeNo: 'EMP-X',
      hireDate: '2026-06-01',
      status: 'active',
      employmentType: 'contract',
      tcKimlik: '10000000146',
      userId: 42,
    });
    assert.equal(input.status, 'active');
    assert.equal(input.employmentType, 'contract');
    assert.equal(input.tcKimlik, '10000000146');
    assert.equal(input.userId, 42);
  });

  it('candidate.phone null ise input.phone null', () => {
    const c = makeCandidate({ phone: null });
    const a = makeApp();
    const input = HireFromApplicationPolicy.toNewEmployeeInput({
      candidate: c,
      application: a,
      departmentId: 10,
      employeeNo: 'EMP-1',
      hireDate: '2026-06-01',
    });
    assert.equal(input.phone, null);
  });

  it('edge: farklı şirket → hata', () => {
    const c = makeCandidate({ companyId: 100 });
    const a = makeApp({ companyId: 200 });
    assert.throws(
      () =>
        HireFromApplicationPolicy.toNewEmployeeInput({
          candidate: c,
          application: a,
          departmentId: 10,
          employeeNo: 'EMP-1',
          hireDate: '2026-06-01',
        }),
      /farklı şirketlerde/,
    );
  });

  it('edge: candidateId Application ile eşleşmiyor → hata', () => {
    const c = makeCandidate({ id: 50 });
    const a = makeApp({ candidateId: 51 });
    assert.throws(
      () =>
        HireFromApplicationPolicy.toNewEmployeeInput({
          candidate: c,
          application: a,
          departmentId: 10,
          employeeNo: 'EMP-1',
          hireDate: '2026-06-01',
        }),
      /eşleşmiyor/,
    );
  });
});
