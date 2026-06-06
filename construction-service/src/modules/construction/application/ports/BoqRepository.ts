/**
 * BoqRepository — keşif satırı kalıcılık portu.
 *
 * replaceLines: bir sözleşmenin tüm keşif satırlarını atomik olarak değiştirir
 * (DELETE + INSERT, transaction). amount/pursantajPct çağrı öncesi use-case'te
 * hesaplanmış olarak gelir.
 * Concrete: infrastructure/persistence/PgBoqRepository.ts
 */
import type { BoqLine } from '../../domain/entities/BoqLine.js';

export interface NewBoqLineInput {
  groupId: number | null;
  pozId: number | null;
  lineNo: number;
  pozNo: string | null;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  pursantajPct: number;
}

export interface BoqRepository {
  listLinesByContract(contractId: number, companyId: number): Promise<ReadonlyArray<BoqLine>>;
  replaceLines(
    contractId: number,
    companyId: number,
    lines: ReadonlyArray<NewBoqLineInput>,
  ): Promise<ReadonlyArray<BoqLine>>;
}
