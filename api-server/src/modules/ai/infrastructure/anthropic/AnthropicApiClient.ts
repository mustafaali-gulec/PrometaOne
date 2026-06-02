/**
 * AnthropicApiClient — ClaudeApi port'unun gerçek implementasyonu.
 *
 * fetch ile Anthropic Messages API'ye çağrı.
 * Eski api-server/src/routes/ai-proxy.ts mantığının TS strict versiyonu.
 */
import {
  ClaudeApiNetworkError,
  ClaudeApiNotConfiguredError,
  ClaudeApiUpstreamError,
  type ClaudeApi,
  type ClaudeApiResponse,
} from '../../application/ports/ClaudeApi.js';
import type { ChatRequest } from '../../domain/entities/ChatRequest.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export interface AnthropicApiClientConfig {
  /** ANTHROPIC_API_KEY — yoksa send() ClaudeApiNotConfiguredError fırlatır. */
  apiKey: string | null;
  /** Test'te override edilebilir; varsayılan resmi Anthropic endpoint. */
  endpoint?: string;
}

interface AnthropicMessagesResponse {
  content?: Array<{ type: string; text?: string }>;
  model?: string;
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
}

export class AnthropicApiClient implements ClaudeApi {
  private readonly endpoint: string;

  constructor(private readonly cfg: AnthropicApiClientConfig) {
    this.endpoint = cfg.endpoint ?? ANTHROPIC_URL;
  }

  async send(request: ChatRequest): Promise<ClaudeApiResponse> {
    if (this.cfg.apiKey === null || this.cfg.apiKey === '') {
      throw new ClaudeApiNotConfiguredError();
    }

    const body = {
      model: request.model,
      max_tokens: request.maxTokens,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
      ...(request.system !== null ? { system: request.system } : {}),
    };

    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.cfg.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
      });
    } catch (cause: unknown) {
      throw new ClaudeApiNetworkError(cause);
    }

    const rawText = await response.text();
    let parsed: AnthropicMessagesResponse;
    try {
      parsed = JSON.parse(rawText) as AnthropicMessagesResponse;
    } catch {
      throw new ClaudeApiUpstreamError(response.status, rawText.slice(0, 200));
    }

    if (!response.ok) {
      throw new ClaudeApiUpstreamError(
        response.status,
        parsed.error?.message ?? `HTTP ${response.status}`,
      );
    }

    // Anthropic content: [{ type: 'text', text: '...' }, ...]
    const textContent = (parsed.content ?? [])
      .filter((c) => c.type === 'text' && c.text !== undefined)
      .map((c) => c.text ?? '')
      .join('');

    return {
      content: textContent,
      model: parsed.model ?? request.model,
      inputTokens: parsed.usage?.input_tokens ?? null,
      outputTokens: parsed.usage?.output_tokens ?? null,
      stopReason: parsed.stop_reason ?? null,
    };
  }
}
