/**
 * AI modülü — Public API.
 */

export type { ChatRole } from './domain/valueObjects/ChatRole';
export type {
  ChatMessageDto,
  ChatRequestDto,
  ChatResponseDto,
} from './application/dto/ChatDto';
export type { AuthTokenProvider } from './application/ports/AuthTokenProvider';
export type { AiAssistantApi } from './application/ports/AiAssistantApi';
export { AiAssistantApiClient } from './infrastructure/api/AiAssistantApiClient';
export {
  useAiChat,
  type UseAiChatResult,
  type UseAiChatOptions,
} from './presentation/hooks/useAiChat';
export {
  AiAssistantWidget,
  type AiAssistantWidgetProps,
} from './presentation/components/AiAssistantWidget';
