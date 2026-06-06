/**
 * Poz (birim fiyat katalog) use-case'leri.
 */
import { DuplicatePozError, PozNotFoundError } from '../../domain/errors/ConstructionErrors.js';
import { round2 } from '../../domain/valueObjects/Currency.js';
import { toPozDto, type PozDto } from '../dto/PozDtos.js';
import type { Clock } from '../ports/Clock.js';
import type { ListPozOptions, PozCatalogRepository } from '../ports/PozCatalogRepository.js';

export interface CreatePozInput {
  companyId: number;
  pozNo: string;
  name: string;
  unit: string;
  unitPrice?: number | undefined;
  source?: string | null | undefined;
  year?: number | null | undefined;
  createdBy?: number | null | undefined;
}

export class CreatePozUseCase {
  constructor(private readonly pozs: PozCatalogRepository) {}

  async execute(input: CreatePozInput): Promise<PozDto> {
    const pozNo = input.pozNo.trim();
    const year = input.year ?? null;
    if (await this.pozs.existsByPozNo(input.companyId, pozNo, year)) {
      throw new DuplicatePozError(pozNo);
    }
    const created = await this.pozs.insert({
      companyId: input.companyId,
      pozNo,
      name: input.name.trim(),
      unit: input.unit.trim(),
      unitPrice: round2(input.unitPrice ?? 0),
      source: input.source?.trim() || null,
      year,
      createdBy: input.createdBy ?? null,
    });
    return toPozDto(created);
  }
}

export interface ListPozInput {
  companyId: number;
  includeInactive?: boolean;
  search?: string;
}

export class ListPozUseCase {
  constructor(private readonly pozs: PozCatalogRepository) {}

  async execute(input: ListPozInput): Promise<PozDto[]> {
    const options: ListPozOptions = {};
    if (input.includeInactive !== undefined) options.includeInactive = input.includeInactive;
    if (input.search !== undefined) options.search = input.search;
    const list = await this.pozs.listByCompany(input.companyId, options);
    return list.map(toPozDto);
  }
}

export interface UpdatePozInput {
  companyId: number;
  pozId: number;
  name?: string | undefined;
  unit?: string | undefined;
  unitPrice?: number | undefined;
  source?: string | null | undefined;
  year?: number | null | undefined;
}

export class UpdatePozUseCase {
  constructor(
    private readonly pozs: PozCatalogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdatePozInput): Promise<PozDto> {
    const poz = await this.pozs.findById(input.pozId, input.companyId);
    if (!poz) throw new PozNotFoundError(input.pozId);
    const updated = poz.update(
      {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.unitPrice !== undefined ? { unitPrice: round2(input.unitPrice) } : {}),
        ...(input.source !== undefined ? { source: input.source } : {}),
        ...(input.year !== undefined ? { year: input.year } : {}),
      },
      this.clock.now(),
    );
    await this.pozs.update(updated);
    return toPozDto(updated);
  }
}

export interface DeactivatePozInput {
  companyId: number;
  pozId: number;
}

export class DeactivatePozUseCase {
  constructor(
    private readonly pozs: PozCatalogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: DeactivatePozInput): Promise<PozDto> {
    const poz = await this.pozs.findById(input.pozId, input.companyId);
    if (!poz) throw new PozNotFoundError(input.pozId);
    const deactivated = poz.deactivate(this.clock.now());
    await this.pozs.update(deactivated);
    return toPozDto(deactivated);
  }
}
