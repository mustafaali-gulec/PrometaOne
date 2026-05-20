import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Email, InvalidEmailError } from '../../domain/valueObjects/Email.js';

describe('Email', () => {
  it('geçerli formatlar kabul edilir', () => {
    const e = Email.create('User@Example.Com');
    assert.equal(e.value, 'user@example.com', 'lowercase\'e çevrilir');
    assert.equal(e.domain, 'example.com');
    assert.equal(e.toString(), 'user@example.com');
  });

  it('boş email fırlatır', () => {
    assert.throws(() => Email.create('   '), InvalidEmailError);
  });

  it('254 karakter üstü fırlatır', () => {
    const long = 'a'.repeat(245) + '@example.com';
    assert.throws(() => Email.create(long), /254 karakteri/);
  });

  it('@ yok ise fırlatır', () => {
    assert.throws(() => Email.create('foo'), /Geçersiz email/);
  });

  it('domain TLD yok ise fırlatır', () => {
    assert.throws(() => Email.create('foo@bar'), /Geçersiz email/);
  });

  it('boşluk içeriyorsa fırlatır', () => {
    assert.throws(() => Email.create('foo @bar.com'), /Geçersiz email/);
  });
});
