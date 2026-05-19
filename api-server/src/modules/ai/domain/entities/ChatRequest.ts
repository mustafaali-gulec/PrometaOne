/**
 * ChatRequest — kullanıcının asistan'a gönderdiği komple talep.
 *
 * - messages: chat geçmişi (en az 1 mesaj)
 * - system: opsiyonel sistem promptu (rol talimatı)
 * - model: Claude model versiyonu
 * - maxTokens: cevap için üst sınır
 *
 * Immutable, doğrulama ile.
 */
import { ChatMessage } from './ChatMessage.js';

export interface ChatRequestProps {
  messages: ReadonlyArray<ChatMessage>;
  system: string | null;
  model: string;
  maxTokens: number;
}

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 1000;
const MIN_MAX_TOKENS = 1;
const MAX_MAX_TOKENS = 4096;

export class ChatRequest {
  private constructor(private readonly props: Readonly<ChatRequestProps>) {}

  static create(input: {
    messages: ReadonlyArray<ChatMessage>;
    system?: string | null | undefined;
    model?: string | undefined;
    maxTokens?: number | undefined;
  }): ChatRequest {
    if (input.messages.length === 0) {
      throw new Error('ChatRequest.messages en az 1 mesaj içermeli');
    }
    const maxTokens = input.maxTokens ?? DEFAULT_MAX_TOKENS;
    if (maxTokens < MIN_MAX_TOKENS || maxTokens > MAX_MAX_TOKENS) {
      throw new Error(`maxTokens ${MIN_MAX_TOKENS}-${MAX_MAX_TOKENS} aralığında olmalı`);
    }
    return new ChatRequest({
      messages: input.messages,
      system: input.system ?? null,
      model: input.model ?? DEFAULT_MODEL,
      maxTokens,
    });
  }

  get messages(): ReadonlyArray<ChatMessage> {
    return this.props.messages;
  }
  get system(): string | null {
    return this.props.system;
  }
  get model(): string {
    return this.props.model;
  }
  get maxTokens(): number {
    return this.props.maxTokens;
  }
}
