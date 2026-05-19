import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ChatMessage } from '../../domain/entities/ChatMessage.js';

describe('ChatMessage', () => {
  it('create geçerli prop\'larla başarılı', () => {
    const m = ChatMessage.create({ role: 'user', content: 'Merhaba' });
    assert.equal(m.role, 'user');
    assert.equal(m.content, 'Merhaba');
  });

  it('boş content ile fırlatır', () => {
    assert.throws(
      () => ChatMessage.create({ role: 'user', content: '' }),
      /boş olamaz/,
    );
  });

  it('100K karakter üstü içerik fırlatır', () => {
    const huge = 'a'.repeat(100_001);
    assert.throws(
      () => ChatMessage.create({ role: 'assistant', content: huge }),
      /100\.000 karakteri/,
    );
  });

  it('100K tam sınır kabul edilir', () => {
    const max = 'a'.repeat(100_000);
    const m = ChatMessage.create({ role: 'user', content: max });
    assert.equal(m.content.length, 100_000);
  });
});
