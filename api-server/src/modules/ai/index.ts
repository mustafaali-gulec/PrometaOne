/**
 * AI modülü — Public API + DI composition root.
 *
 * Dış dünyaya açılan tek arayüz. `api-server/src/index.ts` sadece
 * `registerAiModule`'u çağırır.
 */
import type { Hono } from 'hono';

import type { ChatMessageDto, ChatRequestDto, ChatResponseDto } from './application/dto/ChatDto.js';
import type {
  ParseLoanDocRequestDto,
  ParseLoanDocResultDto,
} from './application/dto/LoanDocDto.js';
import {
  ClaudeApiNetworkError,
  ClaudeApiNotConfiguredError,
  ClaudeApiUpstreamError,
  type ClaudeApi,
  type ClaudeApiResponse,
} from './application/ports/ClaudeApi.js';
import {
  LoanDocServiceUnavailableError,
  LoanDocUpstreamError,
  UnsupportedLoanDocError,
  type LoanDocExtractor,
} from './application/ports/LoanDocExtractor.js';
import { ChatWithAssistantUseCase } from './application/useCases/ChatWithAssistantUseCase.js';
import { ParseLoanDocumentUseCase } from './application/useCases/ParseLoanDocumentUseCase.js';
import { ChatMessage } from './domain/entities/ChatMessage.js';
import type { ChatMessageProps } from './domain/entities/ChatMessage.js';
import { ChatRequest } from './domain/entities/ChatRequest.js';
import type { ChatRequestProps } from './domain/entities/ChatRequest.js';
import type { ChatRole } from './domain/valueObjects/ChatRole.js';
import { AnthropicApiClient } from './infrastructure/anthropic/AnthropicApiClient.js';
import { MlLoanDocClient } from './infrastructure/ml/MlLoanDocClient.js';
import { createAiRouter } from './presentation/routes.js';

// ===========================================================================
// Public API re-exports
// ===========================================================================
export { ChatMessage, ChatRequest };
export type { ChatMessageProps, ChatRequestProps, ChatRole };
export { ChatWithAssistantUseCase };
export { ParseLoanDocumentUseCase };
export { LoanDocServiceUnavailableError, LoanDocUpstreamError, UnsupportedLoanDocError };
export { ClaudeApiNetworkError, ClaudeApiNotConfiguredError, ClaudeApiUpstreamError };
export type { ClaudeApi, ClaudeApiResponse, LoanDocExtractor };
export type { ChatMessageDto, ChatRequestDto, ChatResponseDto };
export type { ParseLoanDocRequestDto, ParseLoanDocResultDto };
export { AnthropicApiClient, MlLoanDocClient };

// ===========================================================================
// DI composition — registerAiModule
// ===========================================================================

export interface AiModuleConfig {
  /** ANTHROPIC_API_KEY — yoksa /v1/ai/chat 503 döner. */
  anthropicApiKey: string | undefined;
  /** Yerel ML servisi kök URL'i (kredi belgesi okuma). Varsayılan host.docker.internal:8001. */
  mlServiceUrl?: string | undefined;
}

export interface AiModuleDeps {
  /** Test/staging için override edilebilir Claude API. */
  claudeApi?: ClaudeApi;
  /** Test/staging için override edilebilir kredi belgesi çıkarıcı. */
  loanDocExtractor?: LoanDocExtractor;
}

export interface RegisteredAiModule {
  router: Hono;
  useCases: {
    chat: ChatWithAssistantUseCase;
    parseLoanDocument: ParseLoanDocumentUseCase;
  };
}

export function registerAiModule(cfg: AiModuleConfig, deps: AiModuleDeps = {}): RegisteredAiModule {
  const apiKey = cfg.anthropicApiKey ?? null;
  const claudeApi = deps.claudeApi ?? new AnthropicApiClient({ apiKey });
  const loanDocExtractor =
    deps.loanDocExtractor ??
    new MlLoanDocClient({ baseUrl: cfg.mlServiceUrl ?? 'http://host.docker.internal:8001' });

  const chat = new ChatWithAssistantUseCase(claudeApi);
  const parseLoanDocument = new ParseLoanDocumentUseCase(loanDocExtractor);
  const router = createAiRouter({ chatUseCase: chat, parseLoanDocUseCase: parseLoanDocument });

  return {
    router,
    useCases: { chat, parseLoanDocument },
  };
}
