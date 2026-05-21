import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Employee } from '../../domain/entities/Employee.js';
import { EmployeeNumber } from '../../domain/valueObjects/EmployeeNumber.js';
import { InvalidEmployeeTransitionError } from '../../domain/valueObjects/EmployeeStatus.js';
import { HireDate } from '../../domain/valueObjects/HireDate.js';
import { PhoneNumber } from '../../domain/valueObjects/PhoneNumber.js';
import { TcKimlik } from '../../domain/valueObjects/TcKimlik.js';

const TODAY = new Date('2026-05-21T00:00:00Z');

function makeEmp(overrides: Record<string, unknown> = {}): Employee {
  const baseDate = new Date('2026-05-21T09:00:00Z');
  const props = {
    id: 1,
    companyId: 100,
    userId: null as number | null,
    departmentId: 10,
    positionId: 5 as number | null,
    employeeNo: EmployeeNumber.create('EMP-000001'),
    firstName: 'Ayşe',
    lastName: 'Yılmaz',
    tcKimlik: null as TcKimlik | null,
    email: null as string | null,
    phone: null as PhoneNumber | null,
    hireDate: HireDate.create(new Date('2026-01-15T00:00:00Z'), TODAY),
    terminationDate: null as Date | null,
    status: 'probation' as const,
    employmentType: 'full_time' as const,
    sourceApplicationId: null as number | null,
    createdAt: baseDate,
    updatedAt: baseDate,
    ...overrides,
  };
  return Employee.create(props);
}

describe('Employee', () => {
  describe('create()', () => {
    it('geçerli props ile başarılı', () => {
      const e = makeEmp();
      assert.equal(e.id, 1);
      assert.equal(e.fullName, 'Ayşe Yılmaz');
      assert.equal(e.status, 'probation');
      assert.equal(e.isActive(), true);
      assert.equal(e.hasUserLink(), false);
    });

    it('id <= 0 fırlatır', () => {
      assert.throws(() => makeEmp({ id: 0 }), /id pozitif olmalı/);
    });

    it('departmentId <= 0 fırlatır', () => {
      assert.throws(() => makeEmp({ departmentId: 0 }), /departmentId pozitif olmalı/);
    });

    it('boş firstName fırlatır', () => {
      assert.throws(() => makeEmp({ firstName: '   ' }), /firstName boş/);
    });

    it('boş lastName fırlatır', () => {
      assert.throws(() => makeEmp({ lastName: '   ' }), /lastName boş/);
    });

    it('terminated status ama terminationDate=null fırlatır', () => {
      assert.throws(
        () =>
          makeEmp({
            status: 'terminated',
            terminationDate: null,
          }),
        /terminationDate dolu/,
      );
    });

    it('terminationDate hireDate öncesi fırlatır', () => {
      assert.throws(
        () =>
          makeEmp({
            status: 'terminated',
            terminationDate: new Date('2025-01-01T00:00:00Z'), // hireDate=2026-01-15
          }),
        /hireDate öncesi/,
      );
    });
  });

  describe('isActive()', () => {
    it('probation ve active true', () => {
      assert.equal(makeEmp({ status: 'probation' }).isActive(), true);
      assert.equal(makeEmp({ status: 'active' }).isActive(), true);
    });

    it('on_leave ve terminated false', () => {
      assert.equal(makeEmp({ status: 'on_leave' }).isActive(), false);
      assert.equal(
        makeEmp({
          status: 'terminated',
          terminationDate: new Date('2026-03-01T00:00:00Z'),
        }).isActive(),
        false,
      );
    });
  });

  describe('updateProfile()', () => {
    const now = new Date('2026-05-22T09:00:00Z');

    it('isim güncellemesi', () => {
      const e = makeEmp();
      const r = e.updateProfile({ firstName: 'Fatma' }, now);
      assert.equal(r.firstName, 'Fatma');
      assert.equal(r.lastName, 'Yılmaz');
      assert.equal(e.firstName, 'Ayşe', 'orijinal değişmemeli');
    });

    it('phone null verirken bağı koparır', () => {
      const e = makeEmp({ phone: PhoneNumber.create('05321234567') });
      const r = e.updateProfile({ phone: null }, now);
      assert.equal(r.phone, null);
    });

    it('phone undefined verirken mevcut korunur', () => {
      const phone = PhoneNumber.create('05321234567');
      const e = makeEmp({ phone });
      const r = e.updateProfile({ firstName: 'Yeni' }, now);
      assert.equal(r.phone, phone);
    });

    it('boş firstName fırlatır', () => {
      const e = makeEmp();
      assert.throws(() => e.updateProfile({ firstName: '   ' }, now), /firstName boş/);
    });

    it('tcKimlik atanır', () => {
      const e = makeEmp();
      const r = e.updateProfile({ tcKimlik: TcKimlik.create('10000000146') }, now);
      assert.equal(r.tcKimlik?.value, '10000000146');
    });
  });

  describe('transferTo()', () => {
    const now = new Date('2026-05-22T09:00:00Z');

    it('departmentId değişir', () => {
      const e = makeEmp();
      const r = e.transferTo(20, 5, now);
      assert.equal(r.departmentId, 20);
      assert.equal(r.positionId, 5);
    });

    it('positionId null ile bağı koparır', () => {
      const e = makeEmp();
      const r = e.transferTo(10, null, now);
      assert.equal(r.positionId, null);
    });

    it('aynı dept + position no-op', () => {
      const e = makeEmp({ departmentId: 10, positionId: 5 });
      assert.equal(e.transferTo(10, 5, now), e);
    });

    it('departmentId <= 0 fırlatır', () => {
      const e = makeEmp();
      assert.throws(() => e.transferTo(0, null, now), /departmentId pozitif/);
    });
  });

  describe('transitionTo()', () => {
    const now = new Date('2026-05-22T09:00:00Z');

    it('probation → active', () => {
      const e = makeEmp({ status: 'probation' });
      const r = e.transitionTo('active', now);
      assert.equal(r.status, 'active');
    });

    it('active → on_leave', () => {
      const e = makeEmp({ status: 'active' });
      const r = e.transitionTo('on_leave', now);
      assert.equal(r.status, 'on_leave');
    });

    it('on_leave → active', () => {
      const e = makeEmp({ status: 'on_leave' });
      const r = e.transitionTo('active', now);
      assert.equal(r.status, 'active');
    });

    it('terminated → active YASAK', () => {
      const e = makeEmp({
        status: 'terminated',
        terminationDate: new Date('2026-03-01T00:00:00Z'),
      });
      assert.throws(
        () => e.transitionTo('active', now),
        (err: unknown) => err instanceof InvalidEmployeeTransitionError,
      );
    });

    it('active → probation YASAK', () => {
      const e = makeEmp({ status: 'active' });
      assert.throws(
        () => e.transitionTo('probation', now),
        (err: unknown) => err instanceof InvalidEmployeeTransitionError,
      );
    });

    it('aynı status ise no-op', () => {
      const e = makeEmp({ status: 'active' });
      assert.equal(e.transitionTo('active', now), e);
    });
  });

  describe('terminate()', () => {
    const now = new Date('2026-05-22T09:00:00Z');

    it('active iken çağrılınca status terminated olur', () => {
      const e = makeEmp({ status: 'active' });
      const r = e.terminate(now);
      assert.equal(r.status, 'terminated');
      assert.equal(r.terminationDate?.getTime(), now.getTime());
    });

    it('belirli terminationDate ile', () => {
      const e = makeEmp({ status: 'active' });
      const d = new Date('2026-04-15T00:00:00Z');
      const r = e.terminate(now, d);
      assert.equal(r.terminationDate?.getTime(), d.getTime());
    });

    it('terminationDate hireDate öncesi fırlatır', () => {
      const e = makeEmp({ status: 'active' });
      assert.throws(() => e.terminate(now, new Date('2025-01-01T00:00:00Z')), /hireDate öncesi/);
    });

    it('zaten terminated ise no-op', () => {
      const e = makeEmp({
        status: 'terminated',
        terminationDate: new Date('2026-03-01T00:00:00Z'),
      });
      assert.equal(e.terminate(now), e);
    });

    it('probation → terminated direkt çalışır (deneme süresi reddi)', () => {
      const e = makeEmp({ status: 'probation' });
      const r = e.terminate(now);
      assert.equal(r.status, 'terminated');
    });
  });

  describe('linkUser() / unlinkUser()', () => {
    const now = new Date('2026-05-22T09:00:00Z');

    it('linkUser yeni instance + userId', () => {
      const e = makeEmp();
      const r = e.linkUser(42, now);
      assert.equal(r.userId, 42);
      assert.equal(r.hasUserLink(), true);
      assert.equal(e.userId, null);
    });

    it('linkUser aynı user no-op', () => {
      const e = makeEmp({ userId: 42 });
      assert.equal(e.linkUser(42, now), e);
    });

    it('linkUser userId <= 0 fırlatır', () => {
      const e = makeEmp();
      assert.throws(() => e.linkUser(0, now), /userId pozitif/);
    });

    it('unlinkUser bağlıyı kaldırır', () => {
      const e = makeEmp({ userId: 42 });
      const r = e.unlinkUser(now);
      assert.equal(r.userId, null);
    });

    it('unlinkUser bağlı değilse no-op', () => {
      const e = makeEmp();
      assert.equal(e.unlinkUser(now), e);
    });
  });

  describe('toJSON()', () => {
    it('plain object döner', () => {
      const e = makeEmp();
      const json = e.toJSON();
      assert.equal(json.id, 1);
      assert.equal(json.firstName, 'Ayşe');
      assert.equal(json.employeeNo.value, 'EMP-000001');
    });
  });
});
