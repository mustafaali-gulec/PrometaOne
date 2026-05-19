/**
 * ChatWithAssistantUseCase — kullanıcının chat talebini Claude'a iletir.
 *
 * - DTO → domain entity dönüşümü
 * - ClaudeApi'yi çağırır
 * - Sonucu DTO formatına dönüştürür
 */
import { ChatMessage } from '../../domain/entities/ChatMessage.js';
import { ChatRequest } from '../../domain/entities/ChatRequest.js';
import type { ChatRequestDto, ChatResponseDto } from '../dto/ChatDto.js';
import type { ClaudeApi } from '../ports/ClaudeApi.js';

export class ChatWithAssistantUseCase {
  constructor(private readonly api: ClaudeApi) {}

  async execute(input: ChatRequestDto): Promise<ChatResponseDto> {
    const messages = input.messages.map((m) =>
      ChatMessage.create({ role: m.role, content: m.content }),
    );

    const request = ChatRequest.create({
      messages,
      system: input.system ?? null,
      model: input.model,
      maxTokens: input.maxTokens,
    });

    const response = await this.api.send(request);

    return {
      content: response.content,
      model: response.model,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      stopReason: response.stopReason,
    };
  }
}
