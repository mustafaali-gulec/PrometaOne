/**
 * ListPartiesUseCase — şirketin tüm cari kartlarını döner.
 */
import type { Party } from '../../domain/entities/Party.js';
import type { PartyRepository } from '../ports/PartyRepository.js';

export class ListPartiesUseCase {
  constructor(private readonly parties: PartyRepository) {}

  execute(input: { companyId: number }): Promise<Party[]> {
    return this.parties.listByCompany(input.companyId);
  }
}
