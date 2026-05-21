import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { InvalidTcKimlikError, TcKimlik } from '../../domain/valueObjects/TcKimlik.js';

/**
 * Geçerli TC Kimlik test vektörleri (algoritmik olarak üretildi —
 * gerçek kişilere ait DEĞİL). Mod 10/11 checksum'ları doğru.
 */
const VALID_VECTORS = [
  '10000000146',
  '11111111110',
  '20433218148',
  '70013389034',
  '93863794032',
  '36542351188',
  '71559407862',
];

const INVALID_VECTORS = [
  { value: '', why: 'boş' },
  { value: '123', why: '11 haneden kısa' },
  { value: '123456789012', why: '12 hane' },
  { value: '0123456789x', why: 'rakam dışı karakter' },
  { value: '01234567890', why: 'ilk hane 0' },
  { value: '12345678901', why: 'rastgele 11 hane (checksum hatalı)' },
  { value: '10000000147', why: '10. hane checksum hatalı (147 yerine 146 olmalı)' },
  { value: '11111111111', why: '11. hane checksum hatalı' },
  { value: '00000000000', why: 'tümü 0 + ilk hane 0' },
];

describe('TcKimlik', () => {
  describe('create() — geçerli vektörler', () => {
    for (const v of VALID_VECTORS) {
      it(`${v} geçerli`, () => {
        const t = TcKimlik.create(v);
        assert.equal(t.value, v);
        assert.equal(t.toString(), v);
      });
    }
  });

  describe('create() — geçersiz vektörler', () => {
    for (const { value, why } of INVALID_VECTORS) {
      it(`reddeder: "${value}" (${why})`, () => {
        assert.throws(
          () => TcKimlik.create(value),
          (e: unknown) => e instanceof InvalidTcKimlikError,
        );
      });
    }
  });

  describe('create() — kenar durumlar', () => {
    it('boşlukları trim eder ve sonra doğrular', () => {
      const t = TcKimlik.create('  10000000146  ');
      assert.equal(t.value, '10000000146');
    });

    it('alfa karakter içerirse fırlatır', () => {
      assert.throws(
        () => TcKimlik.create('1234567890A'),
        (e: unknown) => e instanceof InvalidTcKimlikError,
      );
    });
  });

  describe('isValid()', () => {
    it('geçerli için true', () => {
      assert.equal(TcKimlik.isValid('10000000146'), true);
    });

    it('geçersiz için false (fırlatmaz)', () => {
      assert.equal(TcKimlik.isValid('00000000000'), false);
      assert.equal(TcKimlik.isValid(''), false);
      assert.equal(TcKimlik.isValid('abc'), false);
    });
  });
});
