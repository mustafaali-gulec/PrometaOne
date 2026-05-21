/**
 * ListCandidatesUseCase — havuzdaki aday listesi (filter: source, q).
 */
import type { CandidateSource } from '../../domain/valueObjects/CandidateSource.js';
import { toCandidateDto, type CandidateDto } from '../dto/CandidateDto.js';
import type { CandidateRepository } from '../ports/CandidateRepository.js';

export interface ListCandidatesInput {
  companyId: number;
  source?: CandidateSource;
  q?: string;
}

export class ListCandidatesUseCase {
  constructor(private readonly candidates: CandidateRepository) {}

  async execute(input: ListCandidatesInput): Promise<ReadonlyArray<CandidateDto>> {
    const opts: { source?: CandidateSource; q?: string } = {};
    if (input.source !== undefined) opts.source = input.source;
    if (input.q !== undefined) opts.q = input.q;
    const list = await this.candidates.listByCompany(input.companyId, opts);
    return list.map(toCandidateDto);
  }
}
