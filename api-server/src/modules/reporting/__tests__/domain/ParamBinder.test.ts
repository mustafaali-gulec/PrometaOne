/**
 * ParamBinder birim testleri.
 * Çalıştır: npm test  (tsx --test)
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { InvalidParamError, MissingParamError } from '../../domain/errors/ReportingErrors.js';
import { bindNamedParams, type ParamDef } from '../../domain/params/ParamBinder.js';

const defs: ParamDef[] = [
  { name: 'd1', type: 'date', required: true },
  { name: 'minTotal', type: 'number', default: 0 },
  { name: 'durum', type: 'select', options: ['onayli', 'taslak'] },
];

describe('bindNamedParams', () => {
  it(':ad -> $n (ilk görülme sırasına göre), tekrar aynı $n', () => {
    const r = bindNamedParams(
      'SELECT * FROM invoices WHERE date >= :d1 AND total >= :minTotal AND date <= :d1',
      defs,
      { d1: '2026-01-01', minTotal: 100, durum: 'onayli' },
    );
    assert.equal(r.sql, 'SELECT * FROM invoices WHERE date >= $1 AND total >= $2 AND date <= $1');
    assert.deepEqual(r.values, ['2026-01-01', 100]); // durum kullanılmadı
    assert.deepEqual(r.usedNames, ['d1', 'minTotal']);
  });

  it('cast (::) ve array slice yanlış pozitif vermez', () => {
    const r = bindNamedParams(
      'SELECT total::numeric, (arr)[1:2] FROM invoices WHERE id = :minTotal',
      defs,
      {
        minTotal: 5,
      },
    );
    assert.equal(r.sql, 'SELECT total::numeric, (arr)[1:2] FROM invoices WHERE id = $1');
    assert.deepEqual(r.values, [5]);
  });

  it('string içindeki :ad bağlanmaz', () => {
    const r = bindNamedParams(
      "SELECT ':d1' AS lit, total FROM invoices WHERE total >= :minTotal",
      defs,
      {
        minTotal: 1,
      },
    );
    assert.equal(r.sql, "SELECT ':d1' AS lit, total FROM invoices WHERE total >= $1");
    assert.deepEqual(r.values, [1]);
  });

  it('eksik zorunlu parametre → MissingParamError', () => {
    assert.throws(
      () => bindNamedParams('SELECT * FROM invoices WHERE date >= :d1', defs, {}),
      MissingParamError,
    );
  });

  it('sayı olmayan değer → InvalidParamError', () => {
    assert.throws(
      () =>
        bindNamedParams('SELECT * FROM invoices WHERE total >= :minTotal', defs, {
          minTotal: 'abc',
        }),
      InvalidParamError,
    );
  });

  it('select izinli değerlerde değil → InvalidParamError', () => {
    assert.throws(
      () => bindNamedParams('SELECT * FROM invoices WHERE status = :durum', defs, { durum: 'xxx' }),
      InvalidParamError,
    );
  });

  it('tanımsız :ad → InvalidParamError', () => {
    assert.throws(
      () => bindNamedParams('SELECT * FROM invoices WHERE x = :ghost', defs, {}),
      InvalidParamError,
    );
  });

  it('varsayılan kullanılır (verilmeyen değer)', () => {
    const r = bindNamedParams('SELECT * FROM invoices WHERE total >= :minTotal', defs, {});
    assert.deepEqual(r.values, [0]);
  });

  it('@monthStart makrosu YYYY-MM-DD üretir', () => {
    const r = bindNamedParams(
      'SELECT * FROM t WHERE d >= :ay',
      [{ name: 'ay', type: 'date', default: '@monthStart' }],
      {},
    );
    assert.match(String(r.values[0]), /^\d{4}-\d{2}-01$/);
  });
});
