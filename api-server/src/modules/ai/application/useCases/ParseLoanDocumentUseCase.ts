/**
 * ParseLoanDocumentUseCase — kredi belgesi (PDF/Excel) → kredi alanları.
 *
 * Çıkarım, yerel ML servisinde kural tabanlı yapılır (harici AI yok).
 * Bu kullanım senaryosu yalnızca dosyayı LoanDocExtractor'a iletir.
 */
import type { ParseLoanDocRequestDto, ParseLoanDocResultDto } from '../dto/LoanDocDto.js';
import type { LoanDocExtractor } from '../ports/LoanDocExtractor.js';

export class ParseLoanDocumentUseCase {
  constructor(private readonly extractor: LoanDocExtractor) {}

  execute(input: ParseLoanDocRequestDto): Promise<ParseLoanDocResultDto> {
    return this.extractor.parse(input);
  }
}
