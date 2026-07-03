/**
 * Lisans doğrulayıcı (verifier) unit testleri.
 *
 * Test içinde geçici Ed25519 anahtar çifti üretilir; imzalar canonicalJSON
 * üzerinden atılır (üretici CLI ile birebir aynı format).
 */
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign as cryptoSign } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  canonicalJSON,
  licenseDaysLeft,
  verifyLicense,
  type LicensePayload,
} from '../application/verifier.js';

// ============================================================================
// Test yardımcıları
// ============================================================================
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

const { privateKey: rogueKey } = generateKeyPairSync('ed25519');

function makePayload(overrides: Partial<LicensePayload> = {}): LicensePayload {
  return {
    licenseId: 'LIC-2026-TEST01',
    product: 'prometa-one',
    customer: 'Test Firma A.Ş.',
    issuedAt: '2026-07-01T00:00:00.000Z',
    validUntil: '2027-07-03',
    maxTerminals: 5,
    fingerprint: null,
    features: ['*'],
    notes: '',
    ...overrides,
  };
}

function signWith(payload: LicensePayload, key = privateKey): string {
  return cryptoSign(null, Buffer.from(canonicalJSON(payload), 'utf8'), key).toString('base64');
}

function makeLicense(overrides: Partial<LicensePayload> = {}): {
  payload: LicensePayload;
  signature: string;
} {
  const payload = makePayload(overrides);
  return { payload, signature: signWith(payload) };
}

const NOW = new Date('2026-07-03T12:00:00.000Z');

// ============================================================================
describe('canonicalJSON', () => {
  it('anahtarları rekürsif alfabetik sıralar (ekleme sırasından bağımsız)', () => {
    const a = { b: 1, a: { z: [1, { y: 2, x: 3 }], k: 'v' } };
    const b = { a: { k: 'v', z: [1, { x: 3, y: 2 }] }, b: 1 };
    assert.equal(canonicalJSON(a), canonicalJSON(b));
    assert.equal(canonicalJSON(a), '{"a":{"k":"v","z":[1,{"x":3,"y":2}]},"b":1}');
  });

  it('undefined değerli anahtarları atlar (JSON.stringify ile uyumlu)', () => {
    assert.equal(canonicalJSON({ a: 1, b: undefined }), '{"a":1}');
  });
});

describe('verifyLicense', () => {
  it('happy: geçerli imza + tarih → valid (payload döner)', () => {
    const res = verifyLicense(makeLicense(), { publicKeyPem, now: NOW });
    assert.equal(res.valid, true);
    assert.equal(res.reason, undefined);
    assert.equal(res.payload?.customer, 'Test Firma A.Ş.');
  });

  it('happy: string (dosya içeriği) olarak verilen lisans da doğrulanır', () => {
    const res = verifyLicense(JSON.stringify(makeLicense()), { publicKeyPem, now: NOW });
    assert.equal(res.valid, true);
  });

  it('missing: null / undefined / boş string → reason missing', () => {
    for (const input of [null, undefined, '']) {
      const res = verifyLicense(input, { publicKeyPem, now: NOW });
      assert.deepEqual(res, { valid: false, reason: 'missing' });
    }
  });

  it('invalid_signature: payload tahrif edilirse imza tutmaz', () => {
    const lic = makeLicense();
    const tampered = { ...lic, payload: { ...lic.payload, maxTerminals: 999 } };
    const res = verifyLicense(tampered, { publicKeyPem, now: NOW });
    assert.equal(res.valid, false);
    assert.equal(res.reason, 'invalid_signature');
  });

  it('invalid_signature: başka (sahte) private key ile atılan imza reddedilir', () => {
    const payload = makePayload();
    const forged = { payload, signature: signWith(payload, rogueKey) };
    const res = verifyLicense(forged, { publicKeyPem, now: NOW });
    assert.equal(res.valid, false);
    assert.equal(res.reason, 'invalid_signature');
  });

  it('invalid_signature: bozuk yapı / geçersiz JSON string', () => {
    for (const input of ['bu json degil', {}, { payload: {} }, { signature: 'x' }, [1, 2]]) {
      const res = verifyLicense(input, { publicKeyPem, now: NOW });
      assert.equal(res.valid, false, `girdi: ${JSON.stringify(input)}`);
      assert.equal(res.reason, 'invalid_signature');
    }
  });

  it('wrong_product: imzalı ama başka ürün → reddedilir', () => {
    const res = verifyLicense(makeLicense({ product: 'baska-urun' }), { publicKeyPem, now: NOW });
    assert.equal(res.valid, false);
    assert.equal(res.reason, 'wrong_product');
  });

  it('expired: validUntil geçmişte → reddedilir', () => {
    const res = verifyLicense(makeLicense({ validUntil: '2025-12-31' }), {
      publicKeyPem,
      now: NOW,
    });
    assert.equal(res.valid, false);
    assert.equal(res.reason, 'expired');
  });

  it('expired: validUntil GÜNÜ akşamına kadar (23:59:59 UTC+3) geçerli sayılır', () => {
    const lic = makeLicense({ validUntil: '2026-07-03' });
    // 03 Tem 23:00 İstanbul (= 20:00 UTC) → hâlâ geçerli
    const beforeMidnight = new Date('2026-07-03T20:00:00.000Z');
    assert.equal(verifyLicense(lic, { publicKeyPem, now: beforeMidnight }).valid, true);
    // 04 Tem 00:01 İstanbul (= 03 Tem 21:01 UTC) → süresi dolmuş
    const afterMidnight = new Date('2026-07-03T21:01:00.000Z');
    const res = verifyLicense(lic, { publicKeyPem, now: afterMidnight });
    assert.equal(res.valid, false);
    assert.equal(res.reason, 'expired');
  });

  it('not_yet_valid: issuedAt gelecekte → reddedilir', () => {
    const res = verifyLicense(makeLicense({ issuedAt: '2026-08-01T00:00:00.000Z' }), {
      publicKeyPem,
      now: NOW,
    });
    assert.equal(res.valid, false);
    assert.equal(res.reason, 'not_yet_valid');
  });

  it('fingerprint: kilitli lisans + eşleşen makine (harf duyarsız) → valid', () => {
    const lic = makeLicense({ fingerprint: 'AB12-CD34-EF56-7890' });
    const res = verifyLicense(lic, {
      publicKeyPem,
      fingerprint: 'ab12-cd34-ef56-7890',
      now: NOW,
    });
    assert.equal(res.valid, true);
  });

  it('fingerprint_mismatch: kilitli lisans + farklı/eksik makine kimliği', () => {
    const lic = makeLicense({ fingerprint: 'AB12-CD34-EF56-7890' });
    for (const machine of ['FFFF-0000-1111-2222', null, undefined]) {
      const res = verifyLicense(lic, { publicKeyPem, fingerprint: machine ?? null, now: NOW });
      assert.equal(res.valid, false, `makine: ${String(machine)}`);
      assert.equal(res.reason, 'fingerprint_mismatch');
    }
  });

  it('fingerprint null (kilitsiz) → makine kimliği olmadan da geçer', () => {
    const res = verifyLicense(makeLicense({ fingerprint: null }), { publicKeyPem, now: NOW });
    assert.equal(res.valid, true);
  });
});

describe('licenseDaysLeft', () => {
  it('gelecek tarih → pozitif gün; geçmiş → 0', () => {
    assert.ok(licenseDaysLeft('2027-07-03', NOW) >= 365);
    assert.equal(licenseDaysLeft('2025-01-01', NOW), 0);
    assert.equal(licenseDaysLeft('bozuk-tarih', NOW), 0);
  });
});
