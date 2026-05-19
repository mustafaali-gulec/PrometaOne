import type { ChatRequestDto, ChatResponseDto } from '../dto/ChatDto';

export interface AiAssistantApi {
  chat(request: ChatRequestDto): Promise<ChatResponseDto>;
}
