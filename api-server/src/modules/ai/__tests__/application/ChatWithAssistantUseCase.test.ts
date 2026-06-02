import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ClaudeApi, ClaudeApiResponse } from '../../application/ports/ClaudeApi.js';
import { ChatWithAssistantUseCase } from '../../application/useCases/ChatWithAssistantUseCase.js';
import type { ChatRequest } from '../../domain/entities/ChatRequest.js';

class FakeClaudeApi implements ClaudeApi {
  public lastRequest: ChatRequest | null = null;
  constructor(private readonly response: ClaudeApiResponse) {}
  async send(request: ChatRequest): Promise<ClaudeApiResponse> {
    this.lastRequest = request;
    return this.response;
  }
}

describe('ChatWithAssistantUseCase', () => {
  it("DTO'yu Claude API'ye iletir ve cevabı DTO olarak döner", async () => {
    const fakeApi = new FakeClaudeApi({
      content: 'Selam! Sana nasıl yardımcı olabilirim?',
      model: 'claude-sonnet-4-20250514',
      inputTokens: 12,
      outputTokens: 8,
      stopReason: 'end_turn',
    });
    const uc = new ChatWithAssistantUseCase(fakeApi);

    const result = await uc.execute({
      messages: [{ role: 'user', content: 'Selam' }],
      system: 'You are helpful.',
    });

    assert.equal(result.content, 'Selam! Sana nasıl yardımcı olabilirim?');
    assert.equal(result.inputTokens, 12);
    assert.equal(result.outputTokens, 8);
    assert.equal(result.stopReason, 'end_turn');

    assert.equal(fakeApi.lastRequest?.messages.length, 1);
    assert.equal(fakeApi.lastRequest?.messages[0]?.role, 'user');
    assert.equal(fakeApi.lastRequest?.system, 'You are helpful.');
  });

  it('boş messages ile fırlatır (domain validation)', async () => {
    const fakeApi = new FakeClaudeApi({
      content: '',
      model: '',
      inputTokens: 0,
      outputTokens: 0,
      stopReason: null,
    });
    const uc = new ChatWithAssistantUseCase(fakeApi);

    await assert.rejects(uc.execute({ messages: [] }), /en az 1 mesaj/);
  });

  it('Claude API hatasını yutmaz, yukarı fırlatır', async () => {
    class FailingApi implements ClaudeApi {
      async send(): Promise<ClaudeApiResponse> {
        throw new Error('upstream patladı');
      }
    }
    const uc = new ChatWithAssistantUseCase(new FailingApi());
    await assert.rejects(uc.execute({ messages: [{ role: 'user', content: 'hi' }] }), /upstream/);
  });
});
