/**
 * AI HTTP routes (Hono).
 *
 * Endpoint:
 *   POST /v1/ai/chat
 *
 * Auth gerekli. Zod ile body validation.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { authMiddleware } from '../../../middleware/auth.js';
import {
  ClaudeApiNetworkError,
  ClaudeApiNotConfiguredError,
  ClaudeApiUpstreamError,
} from '../application/ports/ClaudeApi.js';
import {
  LoanDocServiceUnavailableError,
  LoanDocUpstreamError,
  UnsupportedLoanDocError,
} from '../application/ports/LoanDocExtractor.js';
import type { ChatWithAssistantUseCase } from '../application/useCases/ChatWithAssistantUseCase.js';
import type { ParseLoanDocumentUseCase } from '../application/useCases/ParseLoanDocumentUseCase.js';

export interface AiRouterDeps {
  chatUseCase: ChatWithAssistantUseCase;
  parseLoanDocUseCase: ParseLoanDocumentUseCase;
}

const parseLoanDocSchema = z.object({
  fileName: z.string().min(1).max(300),
  mimeType: z.string().max(200).optional(),
  // base64 PDF/Excel — ~15 MB dosya sınırı (base64 ~20 MB).
  contentBase64: z.string().min(1).max(20_000_000),
});

const chatBodySchema = z.object({
  model: z.string().optional(),
  maxTokens: z.number().int().min(1).max(4096).optional(),
  system: z.string().max(20_000).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(100_000),
      }),
    )
    .min(1)
    .max(100),
});

export function createAiRouter(deps: AiRouterDeps): Hono {
  const router = new Hono();

  router.use('*', authMiddleware);

  router.post('/chat', zValidator('json', chatBodySchema), async (c) => {
    const body = c.req.valid('json');

    try {
      const result = await deps.chatUseCase.execute(body);
      return c.json(result);
    } catch (err: unknown) {
      if (err instanceof ClaudeApiNotConfiguredError) {
        throw new HTTPException(503, { message: err.message });
      }
      if (err instanceof ClaudeApiUpstreamError) {
        const status = err.status >= 400 && err.status < 600 ? err.status : 502;
        throw new HTTPException(status as 400 | 401 | 403 | 404 | 429 | 500 | 502 | 503, {
          message: err.message,
        });
      }
      if (err instanceof ClaudeApiNetworkError) {
        throw new HTTPException(502, { message: err.message });
      }
      throw err;
    }
  });

  // Kredi belgesi (PDF/Excel) → yerel ML servisinde kural tabanlı kredi alanı çıkarımı
  router.post('/parse-loan-document', zValidator('json', parseLoanDocSchema), async (c) => {
    const body = c.req.valid('json');
    try {
      const result = await deps.parseLoanDocUseCase.execute(body);
      return c.json(result);
    } catch (err: unknown) {
      if (err instanceof UnsupportedLoanDocError) {
        throw new HTTPException(415, { message: err.message });
      }
      if (err instanceof LoanDocServiceUnavailableError) {
        throw new HTTPException(503, { message: err.message });
      }
      if (err instanceof LoanDocUpstreamError) {
        const status = err.status >= 400 && err.status < 600 ? err.status : 502;
        throw new HTTPException(status as 400 | 401 | 403 | 404 | 422 | 429 | 500 | 502 | 503, {
          message: err.message,
        });
      }
      throw err;
    }
  });

  return router;
}
