import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Password } from '../../domain/valueObjects/Password.js';
import { BcryptPasswordHasher } from '../../infrastructure/bcrypt/BcryptPasswordHasher.js';

describe('BcryptPasswordHasher', () => {
  it('rounds < 8 fırlatır', () => {
    assert.throws(() => new BcryptPasswordHasher({ rounds: 7 }), /8-15 aras/);
  });

  it('rounds > 15 fırlatır', () => {
    assert.throws(() => new BcryptPasswordHasher({ rounds: 16 }), /8-15 aras/);
  });

  it('hash + verify (round-trip)', async () => {
    const hasher = new BcryptPasswordHasher({ rounds: 8 });
    const password = Password.create('admin123');
    const hash = await hasher.hash(password);

    // bcrypt hash format: $2a$|$2b$|$2y$ ile başlar
    assert.match(hash, /^\$2[aby]\$08\$/, 'bcrypt format');
    assert.notEqual(hash, 'admin123', 'plain saklı değil');

    assert.equal(await hasher.verify('admin123', hash), true);
    assert.equal(await hasher.verify('wrong', hash), false);
  });

  it('aynı şifrenin hash\'leri farklı (random salt)', async () => {
    const hasher = new BcryptPasswordHasher({ rounds: 8 });
    const p = Password.create('same-password');
    const a = await hasher.hash(p);
    const b = await hasher.hash(p);
    assert.notEqual(a, b);
    assert.equal(await hasher.verify('same-password', a), true);
    assert.equal(await hasher.verify('same-password', b), true);
  });
});
