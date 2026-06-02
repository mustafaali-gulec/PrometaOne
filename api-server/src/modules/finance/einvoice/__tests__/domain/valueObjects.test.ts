/**
 * E-Fatura value object testleri (PR 1).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  InvalidEttnError,
  InvalidVknError,
  InvalidProviderTypeError,
} from '../../domain/errors/EInvoiceErrors.js';
import {
  isEInvoiceScenario,
  toEInvoiceScenario,
} from '../../domain/valueObjects/EInvoiceScenario.js';
import { isEInvoiceType, toEInvoiceType } from '../../domain/valueObjects/EInvoiceType.js';
import { Ettn } from '../../domain/valueObjects/Ettn.js';
import { isKnownGibStatus, normalizeGibStatus } from '../../domain/valueObjects/GibStatus.js';
import { toInvoiceDirection } from '../../domain/valueObjects/InvoiceDirection.js';
import { toProviderType } from '../../domain/valueObjects/ProviderType.js';
import { Vkn } from '../../domain/valueObjects/Vkn.js';

describe('Vkn', () => {
  it('geçerli VKN (10 hane, checksum) kabul edilir', () => {
    const v = Vkn.create('1234567890'); // checksum-geçerli VKN
    assert.equal(v.value, '1234567890');
    assert.equal(v.kind, 'vkn');
    assert.ok(v.isVkn());
  });

  it('geçerli TCKN (11 hane, NVI algoritması) kabul edilir', () => {
    const v = Vkn.create('10000000146');
    assert.equal(v.kind, 'tckn');
    assert.ok(v.isTckn());
  });

  it('checksum bozuk VKN reddedilir', () => {
    assert.throws(() => Vkn.create('1234567891'), InvalidVknError);
    assert.equal(Vkn.isValid('1234567891'), false);
  });

  it('checksum bozuk TCKN reddedilir', () => {
    assert.throws(() => Vkn.create('10000000147'), InvalidVknError);
  });

  it('ilk hanesi 0 olan TCKN reddedilir', () => {
    assert.equal(Vkn.isValidTckn('01234567890'), false);
  });

  it('yanlış uzunluk / rakam-dışı reddedilir', () => {
    assert.throws(() => Vkn.create('123'), InvalidVknError);
    assert.throws(() => Vkn.create('12345abc90'), InvalidVknError);
    assert.throws(() => Vkn.create(12345), InvalidVknError);
  });

  it('equals değere göre çalışır', () => {
    assert.ok(Vkn.create('1234567890').equals(Vkn.create('1234567890')));
  });
});

describe('Ettn', () => {
  it('geçerli UUID kabul edilir, lowercase normalize', () => {
    const e = Ettn.create('A1B2C3D4-E5F6-7890-ABCD-EF1234567890');
    assert.equal(e.value, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890');
  });

  it('geçersiz format reddedilir', () => {
    assert.throws(() => Ettn.create('not-a-uuid'), InvalidEttnError);
    assert.equal(Ettn.isValid('123'), false);
  });
});

describe('ProviderType / InvoiceDirection / scenarios / types', () => {
  it('toProviderType geçerli/geçersiz', () => {
    assert.equal(toProviderType('elogo'), 'elogo');
    assert.throws(() => toProviderType('foo'), InvalidProviderTypeError);
  });

  it('toInvoiceDirection', () => {
    assert.equal(toInvoiceDirection('incoming'), 'incoming');
    assert.throws(() => toInvoiceDirection('sideways'));
  });

  it('scenario guard + converter', () => {
    assert.ok(isEInvoiceScenario('TICARIFATURA'));
    assert.equal(toEInvoiceScenario('EARSIVFATURA'), 'EARSIVFATURA');
    assert.equal(isEInvoiceScenario('XYZ'), false);
  });

  it('type guard + converter', () => {
    assert.ok(isEInvoiceType('TEVKIFAT'));
    assert.equal(toEInvoiceType('SATIS'), 'SATIS');
    assert.equal(isEInvoiceType('NOPE'), false);
  });
});

describe('GibStatus', () => {
  it('bilinen statü guard', () => {
    assert.ok(isKnownGibStatus('KABUL_EDILDI'));
    assert.equal(isKnownGibStatus('WHATEVER'), false);
  });

  it('normalize: boş/whitespace → null, bilinmeyen korunur', () => {
    assert.equal(normalizeGibStatus('   '), null);
    assert.equal(normalizeGibStatus(null), null);
    assert.equal(normalizeGibStatus('  YENI_KOD '), 'YENI_KOD');
  });
});
