/**
 * Category entity testleri.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Category, type CategoryProps } from '../../domain/entities/Category.js';

const NOW = new Date('2026-01-01T00:00:00Z');

function makeProps(overrides: Partial<CategoryProps> = {}): CategoryProps {
  return {
    id: 1,
    companyId: 100,
    section: 'inflows',
    name: 'Satış Gelirleri',
    sortOrder: 0,
    active: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('Category', () => {
  describe('create()', () => {
    it('geçerli props', () => {
      const c = Category.create(makeProps());
      assert.equal(c.name, 'Satış Gelirleri');
      assert.equal(c.section, 'inflows');
      assert.ok(c.active);
    });
    it('id <= 0 fırlatır', () => {
      assert.throws(() => Category.create(makeProps({ id: 0 })));
    });
    it('companyId <= 0 fırlatır', () => {
      assert.throws(() => Category.create(makeProps({ companyId: -1 })));
    });
    it('boş name fırlatır', () => {
      assert.throws(() => Category.create(makeProps({ name: '   ' })));
    });
    it('200 karakter üstü name fırlatır', () => {
      assert.throws(() => Category.create(makeProps({ name: 'x'.repeat(201) })));
    });
    it('non-integer sortOrder fırlatır', () => {
      assert.throws(() => Category.create(makeProps({ sortOrder: 1.5 })));
    });
  });

  describe('rename()', () => {
    it('yeni isimle yeni instance', () => {
      const c = Category.create(makeProps());
      const r = c.rename('Yeni Ad', NOW);
      assert.equal(r.name, 'Yeni Ad');
      assert.equal(c.name, 'Satış Gelirleri'); // orijinal değişmez
    });
    it('aynı isimle no-op (aynı instance)', () => {
      const c = Category.create(makeProps());
      assert.equal(c.rename('Satış Gelirleri', NOW), c);
    });
    it('boş ad fırlatır', () => {
      assert.throws(() => Category.create(makeProps()).rename('  ', NOW));
    });
  });

  describe('reorder()', () => {
    it('sortOrder değişir', () => {
      const c = Category.create(makeProps({ sortOrder: 0 }));
      assert.equal(c.reorder(5, NOW).sortOrder, 5);
    });
    it('aynı sortOrder no-op', () => {
      const c = Category.create(makeProps({ sortOrder: 3 }));
      assert.equal(c.reorder(3, NOW), c);
    });
    it('non-integer fırlatır', () => {
      assert.throws(() => Category.create(makeProps()).reorder(2.5, NOW));
    });
  });

  describe('archive() / reactivate()', () => {
    it('archive active=false', () => {
      assert.equal(Category.create(makeProps({ active: true })).archive(NOW).active, false);
    });
    it('archive zaten arşivli no-op', () => {
      const c = Category.create(makeProps({ active: false }));
      assert.equal(c.archive(NOW), c);
    });
    it('reactivate arşivlenmişi açar', () => {
      assert.equal(Category.create(makeProps({ active: false })).reactivate(NOW).active, true);
    });
  });
});
