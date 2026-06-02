/**
 * AesGcmCredentialCipher testleri (PR 1) — round-trip + kurcalama + anahtar.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';

import type { CredentialConfig } from '../../domain/entities/EInvoiceCredential.js';
import { CredentialDecryptError } from '../../domain/errors/EInvoiceErrors.js';
import { AesGcmCredentialCipher } from '../../infrastructure/crypto/AesGcmCredentialCipher.js';

const KEY = randomBytes(32);
const config: CredentialConfig = {
  username: 'promet_user',
  password: 's3cr3t-p@ss',
  vergiNo: '1234567890',
  env: 'test',
  wsdlUrl: 'https://efatura.test/ws',
};

describe('AesGcmCredentialCipher', () => {
  it("encrypt → decrypt round-trip orijinal config'i verir", () => {
    const cipher = new AesGcmCredentialCipher(KEY);
    const blob = cipher.encrypt(config);
    assert.equal(blob.iv.length, 12);
    assert.equal(blob.tag.length, 16);
    assert.ok(blob.ciphertext.length > 0);
    // ciphertext düz metni içermemeli
    assert.equal(blob.ciphertext.includes(Buffer.from('s3cr3t-p@ss')), false);

    const decrypted = cipher.decrypt(blob);
    assert.deepEqual(decrypted, config);
  });

  it('her şifreleme farklı IV/ciphertext üretir (deterministik değil)', () => {
    const cipher = new AesGcmCredentialCipher(KEY);
    const a = cipher.encrypt(config);
    const b = cipher.encrypt(config);
    assert.equal(a.iv.equals(b.iv), false);
    assert.equal(a.ciphertext.equals(b.ciphertext), false);
  });

  it('kurcalanmış ciphertext → CredentialDecryptError', () => {
    const cipher = new AesGcmCredentialCipher(KEY);
    const blob = cipher.encrypt(config);
    const tampered = Buffer.from(blob.ciphertext);
    tampered[0] = tampered[0]! ^ 0xff;
    assert.throws(() => cipher.decrypt({ ...blob, ciphertext: tampered }), CredentialDecryptError);
  });

  it('yanlış anahtarla decrypt → CredentialDecryptError', () => {
    const blob = new AesGcmCredentialCipher(KEY).encrypt(config);
    const other = new AesGcmCredentialCipher(randomBytes(32));
    assert.throws(() => other.decrypt(blob), CredentialDecryptError);
  });

  it('32 byte olmayan anahtar reddedilir', () => {
    assert.throws(() => new AesGcmCredentialCipher(randomBytes(16)));
  });

  it('fromEnv: EINVOICE_MASTER_KEY base64 32 byte', () => {
    const env = { EINVOICE_MASTER_KEY: randomBytes(32).toString('base64') } as NodeJS.ProcessEnv;
    const cipher = AesGcmCredentialCipher.fromEnv(env);
    const blob = cipher.encrypt(config);
    assert.deepEqual(cipher.decrypt(blob), config);
  });

  it('fromEnv: eksik/yanlış uzunluk anahtar reddedilir', () => {
    assert.throws(() => AesGcmCredentialCipher.fromEnv({}));
    assert.throws(() =>
      AesGcmCredentialCipher.fromEnv({
        EINVOICE_MASTER_KEY: Buffer.from('short').toString('base64'),
      }),
    );
  });
});
