import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Position } from '../../domain/entities/Position.js';
import { InvalidPositionTransitionError } from '../../domain/valueObjects/PositionStatus.js';

describe('Position', () => {
  const baseDate = new Date('2026-05-21T09:00:00Z');
  const validProps = {
    id: 1,
    companyId: 100,
    departmentId: 10,
    title: 'Yazılım Mühendisi',
    description: null,
    status: 'draft' as const,
    headcountTarget: 1,
    minSalary: null,
    maxSalary: null,
    createdAt: baseDate,
    updatedAt: baseDate,
  };

  describe('create()', () => {
    it('geçerli props ile başarılı', () => {
      const p = Position.create(validProps);
      assert.equal(p.id, 1);
      assert.equal(p.title, 'Yazılım Mühendisi');
      assert.equal(p.status, 'draft');
      assert.equal(p.isOpen(), false);
    });

    it('departmentId === null kabul', () => {
      const p = Position.create({ ...validProps, departmentId: null });
      assert.equal(p.departmentId, null);
    });

    it('id <= 0 fırlatır', () => {
      assert.throws(() => Position.create({ ...validProps, id: 0 }), /id pozitif olmalı/);
    });

    it('boş title fırlatır', () => {
      assert.throws(() => Position.create({ ...validProps, title: '   ' }), /title boş/);
    });

    it('200 karakteri geçen title fırlatır', () => {
      assert.throws(
        () => Position.create({ ...validProps, title: 'A'.repeat(201) }),
        /title 200 karakteri/,
      );
    });

    it('negatif headcountTarget fırlatır', () => {
      assert.throws(
        () => Position.create({ ...validProps, headcountTarget: -1 }),
        /headcountTarget negatif/,
      );
    });

    it('non-integer headcountTarget fırlatır', () => {
      assert.throws(
        () => Position.create({ ...validProps, headcountTarget: 1.5 }),
        /headcountTarget tam sayı/,
      );
    });

    it('minSalary > maxSalary fırlatır', () => {
      assert.throws(
        () => Position.create({ ...validProps, minSalary: 50000, maxSalary: 40000 }),
        /maxSalary üzerinde olamaz/,
      );
    });

    it('minSalary === maxSalary geçerli', () => {
      assert.doesNotThrow(() =>
        Position.create({ ...validProps, minSalary: 50000, maxSalary: 50000 }),
      );
    });

    it('negatif minSalary fırlatır', () => {
      assert.throws(() => Position.create({ ...validProps, minSalary: -100 }), /minSalary negatif/);
    });
  });

  describe('isOpen()', () => {
    it('status open ise true', () => {
      const p = Position.create({ ...validProps, status: 'open' });
      assert.equal(p.isOpen(), true);
    });

    it('status draft ise false', () => {
      assert.equal(Position.create(validProps).isOpen(), false);
    });

    it('status closed ise false', () => {
      const p = Position.create({ ...validProps, status: 'closed' });
      assert.equal(p.isOpen(), false);
    });
  });

  describe('rename()', () => {
    const now = new Date('2026-05-22T09:00:00Z');

    it('yeni başlıkla yeni instance', () => {
      const p = Position.create(validProps);
      const r = p.rename('Senior Yazılım Mühendisi', now);
      assert.equal(r.title, 'Senior Yazılım Mühendisi');
      assert.equal(p.title, 'Yazılım Mühendisi');
      assert.equal(r.updatedAt.getTime(), now.getTime());
    });

    it('aynı title ile no-op', () => {
      const p = Position.create(validProps);
      assert.equal(p.rename('Yazılım Mühendisi', now), p);
    });
  });

  describe('updateHeadcount()', () => {
    const now = new Date('2026-05-22T09:00:00Z');

    it('artırma çalışır', () => {
      const p = Position.create(validProps);
      const r = p.updateHeadcount(5, now);
      assert.equal(r.headcountTarget, 5);
    });

    it('negatif fırlatır', () => {
      const p = Position.create(validProps);
      assert.throws(() => p.updateHeadcount(-1, now), /negatif/);
    });
  });

  describe('updateSalaryRange()', () => {
    const now = new Date('2026-05-22T09:00:00Z');

    it('aralık atar', () => {
      const p = Position.create(validProps);
      const r = p.updateSalaryRange(40000, 60000, now);
      assert.equal(r.minSalary, 40000);
      assert.equal(r.maxSalary, 60000);
    });

    it('min > max fırlatır', () => {
      const p = Position.create(validProps);
      assert.throws(() => p.updateSalaryRange(60000, 40000, now), /üzerinde olamaz/);
    });

    it('her ikisi null bağı koparır', () => {
      const p = Position.create({ ...validProps, minSalary: 40000, maxSalary: 60000 });
      const r = p.updateSalaryRange(null, null, now);
      assert.equal(r.minSalary, null);
      assert.equal(r.maxSalary, null);
    });
  });

  describe('transitionTo()', () => {
    const now = new Date('2026-05-22T09:00:00Z');

    it('draft → open çalışır', () => {
      const p = Position.create(validProps);
      const r = p.transitionTo('open', now);
      assert.equal(r.status, 'open');
      assert.equal(r.updatedAt.getTime(), now.getTime());
    });

    it('open → closed çalışır', () => {
      const p = Position.create({ ...validProps, status: 'open' });
      const r = p.transitionTo('closed', now);
      assert.equal(r.status, 'closed');
    });

    it('closed → open çalışır (yeniden aç)', () => {
      const p = Position.create({ ...validProps, status: 'closed' });
      const r = p.transitionTo('open', now);
      assert.equal(r.status, 'open');
    });

    it('open → draft yasak — InvalidPositionTransitionError', () => {
      const p = Position.create({ ...validProps, status: 'open' });
      assert.throws(
        () => p.transitionTo('draft', now),
        (e: unknown) => e instanceof InvalidPositionTransitionError,
      );
    });

    it('closed → draft yasak', () => {
      const p = Position.create({ ...validProps, status: 'closed' });
      assert.throws(
        () => p.transitionTo('draft', now),
        (e: unknown) => e instanceof InvalidPositionTransitionError,
      );
    });

    it('aynı status ise no-op', () => {
      const p = Position.create(validProps);
      assert.equal(p.transitionTo('draft', now), p);
    });
  });
});
