/**
 * MrpRunRepository — MRP koşusu snapshot kalıcılık portu.
 *
 * Concrete: infrastructure/persistence/PgMrpRunRepository.ts.
 */
import type { MrpParams, MrpResult } from '../../domain/services/MrpCalculator.js';

export interface MrpRunRecord {
  id: number;
  companyId: number;
  no: string;
  runAt: Date;
  params: MrpParams;
  result: MrpResult;
  createdAt: Date;
}

export interface NewMrpRunInput {
  companyId: number;
  no: string;
  runAt: Date;
  params: MrpParams;
  result: MrpResult;
}

export interface MrpRunRepository {
  insert(input: NewMrpRunInput): Promise<MrpRunRecord>;
  listByCompany(
    companyId: number,
    options?: { limit?: number },
  ): Promise<ReadonlyArray<MrpRunRecord>>;
}
