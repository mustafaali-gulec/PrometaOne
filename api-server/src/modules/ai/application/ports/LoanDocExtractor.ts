/**
 * LoanDocExtractor — kredi belgesinden alan çıkaran port.
 *
 * Concrete impl: infrastructure/ml/MlLoanDocClient.ts (yerel ML servisine HTTP).
 * Harici AI (Anthropic) kullanılmaz; çıkarım kural tabanlıdır.
 */
import type { ParseLoanDocRequestDto, ParseLoanDocResultDto } from '../dto/LoanDocDto.js';

export interface LoanDocExtractor {
  parse(input: ParseLoanDocRequestDto): Promise<ParseLoanDocResultDto>;
}

/** Desteklenmeyen dosya tipi (PDF/XLSX/XLS dışı) — HTTP 415. */
export class UnsupportedLoanDocError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedLoanDocError';
  }
}

/** ML servisi erişilemez/çalışmıyor — HTTP 503. */
export class LoanDocServiceUnavailableError extends Error {
  constructor(cause?: unknown) {
    super(
      cause instanceof Error
        ? `Belge okuma servisi (ML) erişilemiyor: ${cause.message}`
        : 'Belge okuma servisi (ML) erişilemiyor',
    );
    this.name = 'LoanDocServiceUnavailableError';
  }
}

/** ML servisinden beklenmedik hata (4xx/5xx) — durum kodu taşınır. */
export class LoanDocUpstreamError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'LoanDocUpstreamError';
  }
}
