import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { InvalidPhoneNumberError, PhoneNumber } from '../../domain/valueObjects/PhoneNumber.js';

describe('PhoneNumber', () => {
  describe('create() — normalize edilebilir TR numaraları', () => {
    const NORMALIZED = '+905321234567';

    const variants = [
      '0532 123 45 67',
      '+905321234567',
      '905321234567',
      '0532-123-45-67',
      '(0532) 1234567',
      '0 532 123 4567',
      '+90 532 123 45 67',
    ];

    for (const v of variants) {
      it(`"${v}" → ${NORMALIZED}`, () => {
        const p = PhoneNumber.create(v);
        assert.equal(p.value, NORMALIZED);
      });
    }
  });

  describe('create() — geçersiz girişler', () => {
    it('boş string fırlatır', () => {
      assert.throws(
        () => PhoneNumber.create(''),
        (e: unknown) => e instanceof InvalidPhoneNumberError,
      );
    });

    it('sadece rakam değil yetersiz hane', () => {
      assert.throws(
        () => PhoneNumber.create('123'),
        (e: unknown) => e instanceof InvalidPhoneNumberError,
      );
    });

    it('5xx ile başlamayan numara reddedilir (sabit hat)', () => {
      assert.throws(
        () => PhoneNumber.create('0212 555 1234'),
        (e: unknown) => e instanceof InvalidPhoneNumberError,
      );
    });

    it('Yabancı ülke kodu reddedilir', () => {
      assert.throws(
        () => PhoneNumber.create('+12025550100'),
        (e: unknown) => e instanceof InvalidPhoneNumberError,
      );
    });

    it('Çok uzun rakam dizisi reddedilir', () => {
      assert.throws(
        () => PhoneNumber.create('905321234567890'),
        (e: unknown) => e instanceof InvalidPhoneNumberError,
      );
    });
  });

  it('toString() value döner', () => {
    const p = PhoneNumber.create('05321234567');
    assert.equal(p.toString(), '+905321234567');
  });
});
