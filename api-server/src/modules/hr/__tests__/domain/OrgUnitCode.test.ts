import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { OrgUnitCode, InvalidOrgUnitCodeError } from '../../domain/valueObjects/OrgUnitCode.js';

describe('OrgUnitCode', () => {
  it('create() geçerli kod ile başarılı', () => {
    const c = OrgUnitCode.create('HQ-001');
    assert.equal(c.value, 'HQ-001');
    assert.equal(c.toString(), 'HQ-001');
  });

  it('create() boşlukları trim eder', () => {
    const c = OrgUnitCode.create('  ABC  ');
    assert.equal(c.value, 'ABC');
  });

  it('create() boş string ile InvalidOrgUnitCodeError fırlatır', () => {
    assert.throws(
      () => OrgUnitCode.create(''),
      (e: unknown) => e instanceof InvalidOrgUnitCodeError && /boş olamaz/.test(e.message),
    );
  });

  it('create() sadece boşluk ile fırlatır', () => {
    assert.throws(
      () => OrgUnitCode.create('   '),
      (e: unknown) => e instanceof InvalidOrgUnitCodeError,
    );
  });

  it('create() 40 karakteri geçenle fırlatır', () => {
    const longCode = 'A'.repeat(41);
    assert.throws(
      () => OrgUnitCode.create(longCode),
      (e: unknown) => e instanceof InvalidOrgUnitCodeError && /40 karakteri/.test(e.message),
    );
  });

  it('create() 40 karakter tam sınırı kabul eder', () => {
    const exactCode = 'A'.repeat(40);
    const c = OrgUnitCode.create(exactCode);
    assert.equal(c.value.length, 40);
  });

  it('create() geçersiz karakter ile fırlatır (boşluk)', () => {
    assert.throws(
      () => OrgUnitCode.create('HQ 001'),
      (e: unknown) => e instanceof InvalidOrgUnitCodeError,
    );
  });

  it('create() geçersiz karakter ile fırlatır (Türkçe karakter)', () => {
    assert.throws(
      () => OrgUnitCode.create('Bölüm-Ç'),
      (e: unknown) => e instanceof InvalidOrgUnitCodeError,
    );
  });

  it('create() altçizgi ve tire kabul eder', () => {
    assert.doesNotThrow(() => OrgUnitCode.create('HR_DEPT-01'));
  });

  it('create() sadece rakam kabul eder', () => {
    assert.doesNotThrow(() => OrgUnitCode.create('12345'));
  });
});
