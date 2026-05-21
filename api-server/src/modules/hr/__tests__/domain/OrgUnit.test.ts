import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { OrgUnit } from '../../domain/entities/OrgUnit.js';
import { OrgUnitCode } from '../../domain/valueObjects/OrgUnitCode.js';

describe('OrgUnit', () => {
  const baseDate = new Date('2026-05-21T09:00:00Z');
  const validProps = {
    id: 1,
    companyId: 100,
    parentId: null,
    name: 'Genel Müdürlük',
    code: null,
    sortOrder: 0,
    active: true,
    createdAt: baseDate,
    updatedAt: baseDate,
  };

  describe('create()', () => {
    it('geçerli props ile başarılı', () => {
      const u = OrgUnit.create(validProps);
      assert.equal(u.id, 1);
      assert.equal(u.companyId, 100);
      assert.equal(u.name, 'Genel Müdürlük');
      assert.equal(u.active, true);
      assert.equal(u.isRoot(), true);
    });

    it("OrgUnitCode value object'i ile başarılı", () => {
      const u = OrgUnit.create({ ...validProps, code: OrgUnitCode.create('HQ') });
      assert.equal(u.code?.value, 'HQ');
    });

    it('id <= 0 fırlatır', () => {
      assert.throws(() => OrgUnit.create({ ...validProps, id: 0 }), /id pozitif olmalı/);
      assert.throws(() => OrgUnit.create({ ...validProps, id: -1 }), /id pozitif olmalı/);
    });

    it('companyId <= 0 fırlatır', () => {
      assert.throws(
        () => OrgUnit.create({ ...validProps, companyId: 0 }),
        /companyId pozitif olmalı/,
      );
    });

    it('parentId === id ise fırlatır', () => {
      assert.throws(
        () => OrgUnit.create({ ...validProps, parentId: 1 }),
        /parentId kendi id ile aynı olamaz/,
      );
    });

    it('parentId <= 0 ama null değil ise fırlatır', () => {
      assert.throws(
        () => OrgUnit.create({ ...validProps, parentId: 0 }),
        /parentId pozitif olmalı/,
      );
    });

    it('boş name fırlatır', () => {
      assert.throws(() => OrgUnit.create({ ...validProps, name: '   ' }), /name boş olamaz/);
    });

    it('200 karakteri geçen name fırlatır', () => {
      assert.throws(
        () => OrgUnit.create({ ...validProps, name: 'A'.repeat(201) }),
        /name 200 karakteri/,
      );
    });

    it('non-integer sortOrder fırlatır', () => {
      assert.throws(() => OrgUnit.create({ ...validProps, sortOrder: 1.5 }), /sortOrder tam sayı/);
    });
  });

  describe('isRoot()', () => {
    it('parentId === null ise true', () => {
      assert.equal(OrgUnit.create(validProps).isRoot(), true);
    });

    it('parentId değer varsa false', () => {
      const u = OrgUnit.create({ ...validProps, id: 2, parentId: 1 });
      assert.equal(u.isRoot(), false);
    });
  });

  describe('rename()', () => {
    const now = new Date('2026-05-22T09:00:00Z');

    it('yeni isimle yeni instance döner', () => {
      const original = OrgUnit.create(validProps);
      const renamed = original.rename('Merkez', now);
      assert.equal(renamed.name, 'Merkez');
      assert.equal(original.name, 'Genel Müdürlük', 'orijinal değişmemeli');
      assert.notEqual(original, renamed);
      assert.equal(renamed.updatedAt.getTime(), now.getTime());
    });

    it('aynı isim ise aynı instance (no-op)', () => {
      const u = OrgUnit.create(validProps);
      const r = u.rename('Genel Müdürlük', now);
      assert.equal(u, r);
    });

    it('boşlukları trim eder', () => {
      const u = OrgUnit.create(validProps);
      const r = u.rename('  Yeni Ad  ', now);
      assert.equal(r.name, 'Yeni Ad');
    });

    it('boş ad ile fırlatır', () => {
      const u = OrgUnit.create(validProps);
      assert.throws(() => u.rename('   ', now), /name boş olamaz/);
    });

    it('200 karakteri geçen ad ile fırlatır', () => {
      const u = OrgUnit.create(validProps);
      assert.throws(() => u.rename('A'.repeat(201), now), /name 200 karakteri/);
    });
  });

  describe('setParent()', () => {
    const now = new Date('2026-05-22T09:00:00Z');

    it('yeni parent ile yeni instance döner', () => {
      const u = OrgUnit.create(validProps);
      const moved = u.setParent(50, now);
      assert.equal(moved.parentId, 50);
      assert.equal(u.parentId, null);
      assert.equal(moved.updatedAt.getTime(), now.getTime());
    });

    it('null parent (root yapma) çalışır', () => {
      const u = OrgUnit.create({ ...validProps, id: 5, parentId: 1 });
      const root = u.setParent(null, now);
      assert.equal(root.parentId, null);
    });

    it('kendi id ile fırlatır', () => {
      const u = OrgUnit.create(validProps);
      assert.throws(() => u.setParent(1, now), /kendi id ile aynı/);
    });

    it('negatif id ile fırlatır', () => {
      const u = OrgUnit.create(validProps);
      assert.throws(() => u.setParent(-1, now), /pozitif olmalı/);
    });

    it('aynı parent ise no-op', () => {
      const u = OrgUnit.create({ ...validProps, id: 5, parentId: 10 });
      const r = u.setParent(10, now);
      assert.equal(u, r);
    });
  });

  describe('archive() / reactivate()', () => {
    const now = new Date('2026-05-22T09:00:00Z');

    it('archive() active=true ise false yapar', () => {
      const u = OrgUnit.create(validProps);
      const archived = u.archive(now);
      assert.equal(archived.active, false);
      assert.equal(u.active, true);
    });

    it('archive() zaten arşivli ise no-op', () => {
      const u = OrgUnit.create({ ...validProps, active: false });
      assert.equal(u.archive(now), u);
    });

    it('reactivate() arşivlenmişse true yapar', () => {
      const u = OrgUnit.create({ ...validProps, active: false });
      const r = u.reactivate(now);
      assert.equal(r.active, true);
    });

    it('reactivate() zaten aktifse no-op', () => {
      const u = OrgUnit.create(validProps);
      assert.equal(u.reactivate(now), u);
    });
  });

  describe('toJSON()', () => {
    it('plain object döner', () => {
      const u = OrgUnit.create(validProps);
      const json = u.toJSON();
      assert.equal(json.id, 1);
      assert.equal(json.name, 'Genel Müdürlük');
      assert.equal(json.parentId, null);
    });
  });
});
