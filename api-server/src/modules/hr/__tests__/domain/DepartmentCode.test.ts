import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DepartmentCode,
  InvalidDepartmentCodeError,
} from '../../domain/valueObjects/DepartmentCode.js';

describe('DepartmentCode', () => {
  it('create() geçerli kod ile başarılı', () => {
    const c = DepartmentCode.create('FIN');
    assert.equal(c.value, 'FIN');
  });

  it('create() boş string ile fırlatır', () => {
    assert.throws(
      () => DepartmentCode.create(''),
      (e: unknown) => e instanceof InvalidDepartmentCodeError,
    );
  });

  it('create() boşlukları trim eder', () => {
    const c = DepartmentCode.create('  HR  ');
    assert.equal(c.value, 'HR');
  });

  it('create() 40 karakteri geçenle fırlatır', () => {
    assert.throws(
      () => DepartmentCode.create('A'.repeat(41)),
      (e: unknown) => e instanceof InvalidDepartmentCodeError,
    );
  });

  it('create() geçersiz karakter (özel sembol) ile fırlatır', () => {
    assert.throws(
      () => DepartmentCode.create('HR@01'),
      (e: unknown) => e instanceof InvalidDepartmentCodeError,
    );
  });

  it('create() alfanumerik + tire + altçizgi kabul eder', () => {
    assert.doesNotThrow(() => DepartmentCode.create('IT-DEV_01'));
  });
});
