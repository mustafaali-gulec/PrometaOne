import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Department } from '../../domain/entities/Department.js';
import { DepartmentCode } from '../../domain/valueObjects/DepartmentCode.js';

describe('Department', () => {
  const baseDate = new Date('2026-05-21T09:00:00Z');
  const validProps = {
    id: 1,
    companyId: 100,
    orgUnitId: 10,
    name: 'Finans',
    code: null,
    managerEmployeeId: null,
    active: true,
    createdAt: baseDate,
    updatedAt: baseDate,
  };

  describe('create()', () => {
    it('geçerli props ile başarılı', () => {
      const d = Department.create(validProps);
      assert.equal(d.id, 1);
      assert.equal(d.companyId, 100);
      assert.equal(d.orgUnitId, 10);
      assert.equal(d.name, 'Finans');
      assert.equal(d.hasManager(), false);
    });

    it('DepartmentCode value object ile başarılı', () => {
      const d = Department.create({ ...validProps, code: DepartmentCode.create('FIN') });
      assert.equal(d.code?.value, 'FIN');
    });

    it('orgUnitId === null kabul eder', () => {
      const d = Department.create({ ...validProps, orgUnitId: null });
      assert.equal(d.orgUnitId, null);
    });

    it('id <= 0 fırlatır', () => {
      assert.throws(() => Department.create({ ...validProps, id: 0 }), /id pozitif olmalı/);
    });

    it('companyId <= 0 fırlatır', () => {
      assert.throws(
        () => Department.create({ ...validProps, companyId: 0 }),
        /companyId pozitif olmalı/,
      );
    });

    it('negatif orgUnitId fırlatır', () => {
      assert.throws(
        () => Department.create({ ...validProps, orgUnitId: -1 }),
        /orgUnitId pozitif olmalı/,
      );
    });

    it('negatif managerEmployeeId fırlatır', () => {
      assert.throws(
        () => Department.create({ ...validProps, managerEmployeeId: 0 }),
        /managerEmployeeId pozitif olmalı/,
      );
    });

    it('boş name fırlatır', () => {
      assert.throws(() => Department.create({ ...validProps, name: '   ' }), /name boş olamaz/);
    });

    it('200 karakteri geçen name fırlatır', () => {
      assert.throws(
        () => Department.create({ ...validProps, name: 'A'.repeat(201) }),
        /name 200 karakteri/,
      );
    });
  });

  describe('rename()', () => {
    const now = new Date('2026-05-22T09:00:00Z');

    it('yeni isimle yeni instance', () => {
      const d = Department.create(validProps);
      const renamed = d.rename('Muhasebe', now);
      assert.equal(renamed.name, 'Muhasebe');
      assert.equal(d.name, 'Finans');
      assert.equal(renamed.updatedAt.getTime(), now.getTime());
    });

    it('aynı isimle no-op', () => {
      const d = Department.create(validProps);
      assert.equal(d.rename('Finans', now), d);
    });

    it('boş ad fırlatır', () => {
      const d = Department.create(validProps);
      assert.throws(() => d.rename('   ', now), /name boş olamaz/);
    });
  });

  describe('assignToOrgUnit()', () => {
    const now = new Date('2026-05-22T09:00:00Z');

    it('yeni orgUnitId ile yeni instance', () => {
      const d = Department.create(validProps);
      const reassigned = d.assignToOrgUnit(20, now);
      assert.equal(reassigned.orgUnitId, 20);
      assert.equal(d.orgUnitId, 10);
    });

    it('null ile bağı koparır', () => {
      const d = Department.create(validProps);
      const detached = d.assignToOrgUnit(null, now);
      assert.equal(detached.orgUnitId, null);
    });

    it('aynı orgUnitId ile no-op', () => {
      const d = Department.create(validProps);
      assert.equal(d.assignToOrgUnit(10, now), d);
    });

    it('negatif id fırlatır', () => {
      const d = Department.create(validProps);
      assert.throws(() => d.assignToOrgUnit(-1, now), /pozitif olmalı/);
    });
  });

  describe('assignManager()', () => {
    const now = new Date('2026-05-22T09:00:00Z');

    it('manager atar', () => {
      const d = Department.create(validProps);
      const withMgr = d.assignManager(42, now);
      assert.equal(withMgr.managerEmployeeId, 42);
      assert.equal(withMgr.hasManager(), true);
      assert.equal(d.hasManager(), false);
    });

    it('null ile manager bağını koparır', () => {
      const d = Department.create({ ...validProps, managerEmployeeId: 42 });
      const cleared = d.assignManager(null, now);
      assert.equal(cleared.managerEmployeeId, null);
      assert.equal(cleared.hasManager(), false);
    });

    it('aynı manager ile no-op', () => {
      const d = Department.create({ ...validProps, managerEmployeeId: 42 });
      assert.equal(d.assignManager(42, now), d);
    });

    it('negatif id fırlatır', () => {
      const d = Department.create(validProps);
      assert.throws(() => d.assignManager(-1, now), /pozitif olmalı/);
    });
  });

  describe('archive() / reactivate()', () => {
    const now = new Date('2026-05-22T09:00:00Z');

    it('archive() active=false yapar', () => {
      const d = Department.create(validProps);
      const archived = d.archive(now);
      assert.equal(archived.active, false);
    });

    it('archive() zaten arşivli ise no-op', () => {
      const d = Department.create({ ...validProps, active: false });
      assert.equal(d.archive(now), d);
    });

    it('reactivate() arşivlenmişi açar', () => {
      const d = Department.create({ ...validProps, active: false });
      assert.equal(d.reactivate(now).active, true);
    });

    it('reactivate() zaten aktifse no-op', () => {
      const d = Department.create(validProps);
      assert.equal(d.reactivate(now), d);
    });
  });

  describe('toJSON()', () => {
    it('plain object döner', () => {
      const d = Department.create(validProps);
      const json = d.toJSON();
      assert.equal(json.id, 1);
      assert.equal(json.name, 'Finans');
      assert.equal(json.managerEmployeeId, null);
    });
  });
});
