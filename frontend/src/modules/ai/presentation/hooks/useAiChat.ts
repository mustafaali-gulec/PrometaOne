/**
 * useAiChat — mini chat state machine.
 *
 * - messages: konuşma geçmişi (UI render edilir)
 * - send(text): kullanıcı mesajını ekler, AI'a gönderir, cevabını ekler
 * - clear(): konuşmayı sıfırlar
 * - sending: aktif istek var mı
 * - error: son hata
 */
import { useCallback, useState } from 'react';

import type { ChatMessageDto, ChatRequestDto } from '../../application/dto/ChatDto';
import type { AiAssistantApi } from '../../application/ports/AiAssistantApi';

export interface UseAiChatResult {
  messages: ReadonlyArray<ChatMessageDto>;
  sending: boolean;
  error: string | null;
  send: (text: string) => Promise<void>;
  clear: () => void;
}

export interface UseAiChatOptions {
  /** Sistem promptu — Claude'a "sen kimsin" talimatı. */
  system?: string;
  /** Modeli override etmek için. */
  model?: string;
  /** Max output token. */
  maxTokens?: number;
}

export function useAiChat(api: AiAssistantApi, options: UseAiChatOptions = {}): UseAiChatResult {
  const [messages, setMessages] = useState<ReadonlyArray<ChatMessageDto>>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim();
      if (trimmed.length === 0) return;
      if (sending) return;

      const next: ChatMessageDto[] = [...messages, { role: 'user', content: trimmed }];
      setMessages(next);
      setSending(true);
      setError(null);

      const request: ChatRequestDto = {
        messages: next,
        ...(options.system !== undefined ? { system: options.system } : {}),
        ...(options.model !== undefined ? { model: options.model } : {}),
        ...(options.maxTokens !== undefined ? { maxTokens: options.maxTokens } : {}),
      };

      try {
        const response = await api.chat(request);
        setMessages([...next, { role: 'assistant', content: response.content }]);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Bilinmeyen hata');
      } finally {
        setSending(false);
      }
    },
    [api, messages, options.maxTokens, options.model, options.system, sending],
  );

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, sending, error, send, clear };
}
