import type { ChatRole } from '../../domain/valueObjects/ChatRole';

export interface ChatMessageDto {
  role: ChatRole;
  content: string;
}

export interface ChatRequestDto {
  messages: ReadonlyArray<ChatMessageDto>;
  system?: string | undefined;
  model?: string | undefined;
  maxTokens?: number | undefined;
}

export interface ChatResponseDto {
  content: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  stopReason: string | null;
}
