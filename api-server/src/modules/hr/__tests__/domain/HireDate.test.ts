import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { HireDate, InvalidHireDateError } from '../../domain/valueObjects/HireDate.js';

describe('HireDate', () => {
  const today = new Date('2026-05-21T00:00:00Z');

  it('create() geçmiş tarih kabul', () => {
    const d = HireDate.create(new Date('2020-01-15T00:00:00Z'), today);
    assert.equal(d.toISOString(), '2020-01-15');
  });

  it('create() bugünü kabul', () => {
    const d = HireDate.create(today, today);
    assert.equal(d.toISOString(), '2026-05-21');
  });

  it('create() 6 ay sonrasını kabul (1 yıl içinde)', () => {
    const future = new Date('2026-11-15T00:00:00Z');
    assert.doesNotThrow(() => HireDate.create(future, today));
  });

  it('create() 1 yıldan fazla geleceği reddeder', () => {
    const tooFar = new Date('2027-12-01T00:00:00Z');
    assert.throws(
      () => HireDate.create(tooFar, today),
      (e: unknown) => e instanceof InvalidHireDateError,
    );
  });

  it('create() 1900 öncesini reddeder', () => {
    assert.throws(
      () => HireDate.create(new Date('1899-12-31T00:00:00Z'), today),
      (e: unknown) => e instanceof InvalidHireDateError,
    );
  });

  it('create() geçersiz Date reddeder', () => {
    assert.throws(
      () => HireDate.create(new Date('not-a-date'), today),
      (e: unknown) => e instanceof InvalidHireDateError,
    );
  });

  it('create() saat bilgisini sıfırlar (sadece tarih saklar)', () => {
    const withTime = new Date('2026-03-15T14:30:45Z');
    const d = HireDate.create(withTime, today);
    assert.equal(d.toISOString(), '2026-03-15');
    assert.equal(d.value.getUTCHours(), 0);
    assert.equal(d.value.getUTCMinutes(), 0);
  });
});
