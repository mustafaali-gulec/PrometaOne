/**
 * AI modülü — Public API + DI composition root.
 *
 * Dış dünyaya açılan tek arayüz. `api-server/src/index.ts` sadece
 * `registerAiModule`'u çağırır.
 */
import type { Hono } from 'hono';

import type { ChatMessageDto, ChatRequestDto, ChatResponseDto } from './application/dto/ChatDto.js';
import {
  ClaudeApiNetworkError,
  ClaudeApiNotConfiguredError,
  ClaudeApiUpstreamError,
  type ClaudeApi,
  type ClaudeApiResponse,
} from './application/ports/ClaudeApi.js';
import { ChatWithAssistantUseCase } from './application/useCases/ChatWithAssistantUseCase.js';
import { ChatMessage } from './domain/entities/ChatMessage.js';
import type { ChatMessageProps } from './domain/entities/ChatMessage.js';
import { ChatRequest } from './domain/entities/ChatRequest.js';
import type { ChatRequestProps } from './domain/entities/ChatRequest.js';
import type { ChatRole } from './domain/valueObjects/ChatRole.js';
import { AnthropicApiClient } from './infrastructure/anthropic/AnthropicApiClient.js';
import { createAiRouter } from './presentation/routes.js';

// ===========================================================================
// Public API re-exports
// ===========================================================================
export { ChatMessage, ChatRequest };
export type { ChatMessageProps, ChatRequestProps, ChatRole };
export { ChatWithAssistantUseCase };
export { ClaudeApiNetworkError, ClaudeApiNotConfiguredError, ClaudeApiUpstreamError };
export type { ClaudeApi, ClaudeApiResponse };
export type { ChatMessageDto, ChatRequestDto, ChatResponseDto };
export { AnthropicApiClient };

// ===========================================================================
// DI composition — registerAiModule
// ===========================================================================

export interface AiModuleConfig {
  /** ANTHROPIC_API_KEY — yoksa /v1/ai/chat 503 döner. */
  anthropicApiKey: string | undefined;
}

export interface AiModuleDeps {
  /** Test/staging için override edilebilir Claude API. */
  claudeApi?: ClaudeApi;
}

export interface RegisteredAiModule {
  router: Hono;
  useCases: {
    chat: ChatWithAssistantUseCase;
  };
}

export function registerAiModule(cfg: AiModuleConfig, deps: AiModuleDeps = {}): RegisteredAiModule {
  const claudeApi =
    deps.claudeApi ?? new AnthropicApiClient({ apiKey: cfg.anthropicApiKey ?? null });

  const chat = new ChatWithAssistantUseCase(claudeApi);
  const router = createAiRouter({ chatUseCase: chat });

  return {
    router,
    useCases: { chat },
  };
}
