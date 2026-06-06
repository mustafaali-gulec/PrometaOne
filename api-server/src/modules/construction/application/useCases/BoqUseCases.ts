/**
 * Keşif (BoQ) use-case'leri.
 *
 * SaveBoqLines: sözleşmenin keşif satırlarını toplu kaydeder. Her satırın
 * amount = quantity*unitPrice, pursantaj_pct sözleşme toplamına normalize edilir
 * (computePursantajPct). Sözleşme varlığı doğrulanır.
 */
import { ContractNotFoundError } from '../../domain/errors/ConstructionErrors.js';
import { round2 } from '../../domain/valueObjects/Currency.js';
import { computePursantajPct } from '../../domain/valueObjects/Pursantaj.js';
import { toBoqDto, type BoqDto } from '../dto/BoqDtos.js';
import type { BoqRepository, NewBoqLineInput } from '../ports/BoqRepository.js';
import type { ContractRepository } from '../ports/ContractRepository.js';

export interface GetBoqInput {
  companyId: number;
  contractId: number;
}

export class GetBoqUseCase {
  constructor(
    private readonly boq: BoqRepository,
    private readonly contracts: ContractRepository,
  ) {}

  async execute(input: GetBoqInput): Promise<BoqDto> {
    const contract = await this.contracts.findById(input.contractId, input.companyId);
    if (!contract) throw new ContractNotFoundError(input.contractId);
    const lines = await this.boq.listLinesByContract(input.contractId, input.companyId);
    return toBoqDto(input.contractId, lines);
  }
}

export interface BoqLineInput {
  groupId?: number | null | undefined;
  pozId?: number | null | undefined;
  pozNo?: string | null | undefined;
  description: string;
  unit?: string | undefined;
  quantity?: number | undefined;
  unitPrice?: number | undefined;
}

export interface SaveBoqLinesInput {
  companyId: number;
  contractId: number;
  lines: ReadonlyArray<BoqLineInput>;
}

export class SaveBoqLinesUseCase {
  constructor(
    private readonly boq: BoqRepository,
    private readonly contracts: ContractRepository,
  ) {}

  async execute(input: SaveBoqLinesInput): Promise<BoqDto> {
    const contract = await this.contracts.findById(input.contractId, input.companyId);
    if (!contract) throw new ContractNotFoundError(input.contractId);

    const amounts = input.lines.map((l) => round2((l.quantity ?? 0) * (l.unitPrice ?? 0)));
    const pursantaj = computePursantajPct(amounts);

    const prepared: NewBoqLineInput[] = input.lines.map((l, i) => ({
      groupId: l.groupId ?? null,
      pozId: l.pozId ?? null,
      lineNo: i + 1,
      pozNo: l.pozNo?.trim() || null,
      description: l.description.trim(),
      unit: l.unit?.trim() || 'ad',
      quantity: l.quantity ?? 0,
      unitPrice: l.unitPrice ?? 0,
      amount: amounts[i]!,
      pursantajPct: pursantaj[i]!,
    }));

    const saved = await this.boq.replaceLines(input.contractId, input.companyId, prepared);
    return toBoqDto(input.contractId, saved);
  }
}
