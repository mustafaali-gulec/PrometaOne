import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LinkedInAuthError } from '../../domain/errors/LinkedInErrors.js';
import { HmacOAuthStateCodec } from '../../infrastructure/crypto/HmacOAuthStateCodec.js';

const SECRET = 'test-secret-en-az-16-karakter';
const NOW = new Date('2026-08-08T10:00:00.000Z');
const codec = new HmacOAuthStateCodec(SECRET, () => NOW);

const payload = {
  companyId: 7,
  actorId: 42,
  exp: Math.floor(NOW.getTime() / 1000) + 600,
};

describe('HmacOAuthStateCodec', () => {
  it('kendi imzaladığını doğrular', () => {
    assert.deepEqual(codec.verify(codec.sign(payload)), payload);
  });

  it('kısa sır kabul etmez', () => {
    assert.throws(() => new HmacOAuthStateCodec('kisa'), /en az 16 karakter/);
  });

  it('BAŞKA sırla imzalanmış state reddedilir (companyId uydurulamaz)', () => {
    const attacker = new HmacOAuthStateCodec('saldirgan-sirri-16-karakter', () => NOW);
    const forged = attacker.sign({ ...payload, companyId: 999 });
    assert.throws(() => codec.verify(forged), LinkedInAuthError);
  });

  it('gövdesi kurcalanmış state reddedilir', () => {
    const state = codec.sign(payload);
    const dot = state.lastIndexOf('.');
    const tampered =
      Buffer.from(JSON.stringify({ ...payload, companyId: 999 }), 'utf-8').toString('base64url') +
      state.slice(dot);
    assert.throws(() => codec.verify(tampered), LinkedInAuthError);
  });

  it('süresi dolmuş state reddedilir', () => {
    const expired = codec.sign({ ...payload, exp: Math.floor(NOW.getTime() / 1000) - 1 });
    assert.throws(() => codec.verify(expired), /zaman aşımına/);
  });

  it('biçimsiz state reddedilir', () => {
    assert.throws(() => codec.verify('noktasiz'), /biçimsiz/);
    assert.throws(() => codec.verify(''), /biçimsiz/);
  });
});
