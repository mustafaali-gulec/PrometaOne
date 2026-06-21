/**
 * MlLoanDocClient — LoanDocExtractor'ın yerel ML servisi (FastAPI) implementasyonu.
 *
 * api-server, dosyayı (base64) ML servisine iletir; çıkarım orada kural tabanlı
 * (pdfplumber/openpyxl + regex) yapılır. Harici AI/API anahtarı GEREKMEZ.
 *
 * ML servisi api-server ile aynı Docker ağında değil; host üzerinden erişilir
 * (varsayılan http://host.docker.internal:8001).
 */
import type {
  ParseLoanDocRequestDto,
  ParseLoanDocResultDto,
} from '../../application/dto/LoanDocDto.js';
import {
  LoanDocServiceUnavailableError,
  LoanDocUpstreamError,
  UnsupportedLoanDocError,
  type LoanDocExtractor,
} from '../../application/ports/LoanDocExtractor.js';

export interface MlLoanDocClientConfig {
  /** ML servis kök URL'i (ör. http://host.docker.internal:8001). */
  baseUrl: string;
  /** Zaman aşımı (ms). */
  timeoutMs?: number;
}

interface MlErrorBody {
  detail?: string | { msg?: string };
  message?: string;
}

export class MlLoanDocClient implements LoanDocExtractor {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(cfg: MlLoanDocClientConfig) {
    this.baseUrl = cfg.baseUrl.replace(/\/+$/, '');
    this.timeoutMs = cfg.timeoutMs ?? 60_000;
  }

  async parse(input: ParseLoanDocRequestDto): Promise<ParseLoanDocResultDto> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/parse/loan-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: input.fileName,
          mimeType: input.mimeType ?? null,
          contentBase64: input.contentBase64,
        }),
        signal: controller.signal,
      });
    } catch (cause: unknown) {
      throw new LoanDocServiceUnavailableError(cause);
    } finally {
      clearTimeout(timer);
    }

    const rawText = await response.text();

    if (!response.ok) {
      const message = extractErrorMessage(rawText) ?? `HTTP ${response.status}`;
      if (response.status === 415) throw new UnsupportedLoanDocError(message);
      throw new LoanDocUpstreamError(response.status, message);
    }

    let parsed: ParseLoanDocResultDto;
    try {
      parsed = JSON.parse(rawText) as ParseLoanDocResultDto;
    } catch {
      throw new LoanDocUpstreamError(502, 'ML servisi geçersiz yanıt döndü');
    }
    return parsed;
  }
}

function extractErrorMessage(rawText: string): string | null {
  try {
    const body = JSON.parse(rawText) as MlErrorBody;
    if (typeof body.detail === 'string') return body.detail;
    if (body.detail && typeof body.detail === 'object' && typeof body.detail.msg === 'string') {
      return body.detail.msg;
    }
    if (typeof body.message === 'string') return body.message;
  } catch {
    /* düz metin olabilir */
  }
  const trimmed = rawText.trim();
  return trimmed === '' ? null : trimmed.slice(0, 300);
}
