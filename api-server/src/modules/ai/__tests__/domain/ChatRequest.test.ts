import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ChatMessage } from '../../domain/entities/ChatMessage.js';
import { ChatRequest } from '../../domain/entities/ChatRequest.js';

describe('ChatRequest', () => {
  const helloMessage = ChatMessage.create({ role: 'user', content: 'Selam' });

  it('en az 1 mesaj olmalı', () => {
    assert.throws(() => ChatRequest.create({ messages: [] }), /en az 1 mesaj/);
  });

  it('varsayılan model ve maxTokens', () => {
    const req = ChatRequest.create({ messages: [helloMessage] });
    assert.equal(req.model, 'claude-sonnet-4-20250514');
    assert.equal(req.maxTokens, 1000);
    assert.equal(req.system, null);
  });

  it('explicit model override', () => {
    const req = ChatRequest.create({
      messages: [helloMessage],
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 500,
      system: 'You are a CFO assistant.',
    });
    assert.equal(req.model, 'claude-haiku-4-5-20251001');
    assert.equal(req.maxTokens, 500);
    assert.equal(req.system, 'You are a CFO assistant.');
  });

  it('maxTokens üst sınırı (4096)', () => {
    assert.throws(
      () => ChatRequest.create({ messages: [helloMessage], maxTokens: 4097 }),
      /aralığında/,
    );
  });

  it('maxTokens alt sınırı (1)', () => {
    assert.throws(
      () => ChatRequest.create({ messages: [helloMessage], maxTokens: 0 }),
      /aralığında/,
    );
  });
});
