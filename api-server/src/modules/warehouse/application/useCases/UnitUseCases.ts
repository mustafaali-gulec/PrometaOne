/**
 * Ölçü Birimi (Unit) use-case'leri — CRUD.
 */
import { DuplicateUnitCodeError, UnitNotFoundError } from '../../domain/errors/WarehouseErrors.js';
import { toUnitDto, type UnitDto } from '../dto/AuxDtos.js';
import type { Clock } from '../ports/Clock.js';
import type { NewUnitInput, UnitRepository } from '../ports/UnitRepository.js';

export interface CreateUnitInput {
  companyId: number;
  code: string;
  name: string;
}

export class CreateUnitUseCase {
  constructor(private readonly units: UnitRepository) {}

  async execute(input: CreateUnitInput): Promise<UnitDto> {
    const code = input.code.trim();
    if (await this.units.existsByCode(input.companyId, code)) {
      throw new DuplicateUnitCodeError(code);
    }
    const toInsert: NewUnitInput = {
      companyId: input.companyId,
      code,
      name: input.name.trim(),
    };
    const created = await this.units.insert(toInsert);
    return toUnitDto(created);
  }
}

export interface UpdateUnitInput {
  companyId: number;
  unitId: number;
  code?: string;
  name?: string;
}

export class UpdateUnitUseCase {
  constructor(
    private readonly units: UnitRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateUnitInput): Promise<UnitDto> {
    const existing = await this.units.findById(input.unitId, input.companyId);
    if (!existing) {
      throw new UnitNotFoundError(input.unitId);
    }
    if (input.code !== undefined) {
      const code = input.code.trim();
      if (
        code !== existing.code &&
        (await this.units.existsByCode(input.companyId, code, input.unitId))
      ) {
        throw new DuplicateUnitCodeError(code);
      }
    }
    const updated = existing.withUpdates(
      {
        ...(input.code !== undefined ? { code: input.code.trim() } : {}),
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      },
      this.clock.now(),
    );
    await this.units.update(updated);
    return toUnitDto(updated);
  }
}

export class DeleteUnitUseCase {
  constructor(private readonly units: UnitRepository) {}

  async execute(input: { companyId: number; unitId: number }): Promise<{ ok: true }> {
    const existing = await this.units.findById(input.unitId, input.companyId);
    if (!existing) {
      throw new UnitNotFoundError(input.unitId);
    }
    await this.units.remove(input.unitId, input.companyId);
    return { ok: true };
  }
}

export class ListUnitsUseCase {
  constructor(private readonly units: UnitRepository) {}

  async execute(input: { companyId: number }): Promise<UnitDto[]> {
    const list = await this.units.listByCompany(input.companyId);
    return list.map(toUnitDto);
  }
}

export class GetUnitUseCase {
  constructor(private readonly units: UnitRepository) {}

  async execute(input: { companyId: number; unitId: number }): Promise<UnitDto> {
    const u = await this.units.findById(input.unitId, input.companyId);
    if (!u) {
      throw new UnitNotFoundError(input.unitId);
    }
    return toUnitDto(u);
  }
}
