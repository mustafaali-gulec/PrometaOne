/**
 * AiAssistantApiClient — backend POST /v1/ai/chat ile konuşur.
 */
import type { ChatRequestDto, ChatResponseDto } from '../../application/dto/ChatDto';
import type { AiAssistantApi } from '../../application/ports/AiAssistantApi';
import type { AuthTokenProvider } from '../../application/ports/AuthTokenProvider';

export class AiAssistantApiClient implements AiAssistantApi {
  constructor(
    private readonly baseUrl: string,
    private readonly tokens: AuthTokenProvider,
  ) {}

  async chat(request: ChatRequestDto): Promise<ChatResponseDto> {
    const token = this.tokens.getAccessToken();
    if (token === null || token === '') {
      throw new Error('Auth token yok — önce giriş yapın');
    }

    const response = await fetch(`${this.baseUrl}/v1/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const body = (await response.json()) as { message?: string };
        if (body.message !== undefined) message = body.message;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }

    return (await response.json()) as ChatResponseDto;
  }
}
