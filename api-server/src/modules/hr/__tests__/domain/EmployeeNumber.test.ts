import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  EmployeeNumber,
  InvalidEmployeeNumberError,
} from '../../domain/valueObjects/EmployeeNumber.js';

describe('EmployeeNumber', () => {
  it('create() geçerli format ile başarılı', () => {
    const e = EmployeeNumber.create('EMP-000001');
    assert.equal(e.value, 'EMP-000001');
    assert.equal(e.toString(), 'EMP-000001');
  });

  it('create() trim eder', () => {
    const e = EmployeeNumber.create('  EMP-1  ');
    assert.equal(e.value, 'EMP-1');
  });

  it('create() boş ile fırlatır', () => {
    assert.throws(
      () => EmployeeNumber.create(''),
      (e: unknown) => e instanceof InvalidEmployeeNumberError,
    );
  });

  it('create() 40 karakteri geçenle fırlatır', () => {
    assert.throws(
      () => EmployeeNumber.create('A'.repeat(41)),
      (e: unknown) => e instanceof InvalidEmployeeNumberError,
    );
  });

  it('create() özel karakter ile fırlatır', () => {
    assert.throws(
      () => EmployeeNumber.create('EMP@001'),
      (e: unknown) => e instanceof InvalidEmployeeNumberError,
    );
  });

  it('create() boşluk içeren ile fırlatır', () => {
    assert.throws(
      () => EmployeeNumber.create('EMP 001'),
      (e: unknown) => e instanceof InvalidEmployeeNumberError,
    );
  });

  it('create() sadece rakam kabul eder', () => {
    assert.doesNotThrow(() => EmployeeNumber.create('12345'));
  });

  it('create() alfanumerik + tire + altçizgi kabul eder', () => {
    assert.doesNotThrow(() => EmployeeNumber.create('emp_001-X'));
  });
});
