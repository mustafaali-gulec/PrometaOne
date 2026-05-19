/**
 * ClaudeApi — Anthropic Claude API'ye konuşan port (interface).
 *
 * Concrete impl: infrastructure/anthropic/AnthropicApiClient.ts
 * Test'te mock'lanabilir.
 */
import type { ChatRequest } from '../../domain/entities/ChatRequest.js';

export interface ClaudeApiResponse {
  /** Asistan cevabının düz metin içeriği. */
  content: string;
  /** Model isim (örn. 'claude-sonnet-4-20250514') — pass-through. */
  model: string;
  /** Tüketilen token'lar (telemetri için). */
  inputTokens: number | null;
  outputTokens: number | null;
  /** Stop reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | ... */
  stopReason: string | null;
}

export interface ClaudeApi {
  /**
   * Bir ChatRequest gönderir, Claude'un cevabını döner.
   *
   * Hatalar:
   * - ClaudeApiNotConfiguredError: API key yok
   * - ClaudeApiUpstreamError: Anthropic'ten 4xx/5xx
   * - ClaudeApiNetworkError: bağlantı sorunu
   */
  send(request: ChatRequest): Promise<ClaudeApiResponse>;
}

export class ClaudeApiNotConfiguredError extends Error {
  constructor() {
    super('AI servisi yapılandırılmamış (ANTHROPIC_API_KEY tanımlı değil)');
    this.name = 'ClaudeApiNotConfiguredError';
  }
}

export class ClaudeApiUpstreamError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(`Claude API hatası (${status}): ${message}`);
    this.name = 'ClaudeApiUpstreamError';
  }
}

export class ClaudeApiNetworkError extends Error {
  constructor(cause: unknown) {
    super(
      cause instanceof Error ? `Claude API ağ hatası: ${cause.message}` : 'Claude API ağ hatası',
    );
    this.name = 'ClaudeApiNetworkError';
  }
}
