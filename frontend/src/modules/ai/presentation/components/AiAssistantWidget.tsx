/**
 * AiAssistantWidget — basit chat UI.
 *
 * App.jsx satır 12386'daki eski AIAssistantWidget'in modüler karşılığı.
 * Mevcut kullanıcı, mesaj listesi, gönder kutusu, yenile, error banner.
 */
import { useEffect, useRef, useState } from 'react';

import { Bot, Send, Trash2, Sparkles } from 'lucide-react';

import type { AiAssistantApi } from '../../application/ports/AiAssistantApi';
import { useAiChat, type UseAiChatOptions } from '../hooks/useAiChat';

export interface AiAssistantWidgetProps {
  api: AiAssistantApi;
  options?: UseAiChatOptions;
  /** Boş ekranda gösterilen başlangıç ipuçları. */
  starterPrompts?: ReadonlyArray<string>;
}

const DEFAULT_STARTERS = [
  'Bütçe tahminim için ne öneriyorsun?',
  'KDV beyanname tarihleri ne zaman?',
  'Geçen ayki en yüksek gider kategorisi hangisi?',
];

export function AiAssistantWidget({
  api,
  options,
  starterPrompts = DEFAULT_STARTERS,
}: AiAssistantWidgetProps) {
  const { messages, sending, error, send, clear } = useAiChat(api, options ?? {});
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (listRef.current !== null) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length, sending]);

  const submit = (e?: React.FormEvent): void => {
    if (e !== undefined) e.preventDefault();
    void send(input);
    setInput('');
  };

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto h-[600px] rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-cyan-50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-600" />
          <h2 className="text-sm font-semibold text-slate-800">AI Asistan</h2>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50"
            aria-label="Konuşmayı temizle"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
        {messages.length === 0 && !sending && (
          <div className="text-center py-8">
            <Bot className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500 mb-4">Bana finansal sorular sorabilirsin.</p>
            <div className="flex flex-col gap-1 max-w-md mx-auto">
              {starterPrompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    void send(p);
                  }}
                  className="text-left text-sm text-slate-600 px-3 py-2 rounded
                             border border-slate-200 hover:border-emerald-400
                             hover:bg-emerald-50 hover:text-emerald-900 transition"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <ChatBubble key={i} role={m.role} content={m.content} />
        ))}

        {sending && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Bot className="w-4 h-4 animate-pulse" />
            <span>Düşünüyor…</span>
          </div>
        )}

        {error !== null && (
          <div className="rounded bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}
      </div>

      <form
        onSubmit={submit}
        className="flex items-center gap-2 px-3 py-3 border-t border-slate-100 bg-white"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
          placeholder="Bir soru yaz…"
          className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-emerald-500
                     disabled:bg-slate-50 disabled:text-slate-400"
        />
        <button
          type="submit"
          disabled={sending || input.trim().length === 0}
          className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-2 text-sm
                     font-medium text-white hover:bg-emerald-700
                     disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Gönder"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
}

function ChatBubble({ role, content }: ChatBubbleProps) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-line
          ${
            isUser ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-800'
          }`}
      >
        {content}
      </div>
    </div>
  );
}
