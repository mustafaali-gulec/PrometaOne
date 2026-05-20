import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Password, WeakPasswordError } from '../../domain/valueObjects/Password.js';

describe('Password', () => {
  it('8 karakter geçerli', () => {
    const p = Password.create('admin123');
    assert.equal(p.value, 'admin123');
  });

  it('7 karakter fırlatır', () => {
    assert.throws(() => Password.create('abc1234'), WeakPasswordError);
  });

  it('200 karakter tam sınır geçerli', () => {
    const p = Password.create('a'.repeat(200));
    assert.equal(p.value.length, 200);
  });

  it('201 karakter fırlatır', () => {
    assert.throws(() => Password.create('a'.repeat(201)), /200 karakteri/);
  });
});
