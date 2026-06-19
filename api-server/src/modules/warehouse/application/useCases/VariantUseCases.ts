/**
 * Varyant (Variant) use-case'leri — CRUD. options aggregate çocuk olarak
 * replace mantığıyla yazılır.
 */
import type { VariantOption } from '../../domain/entities/Variant.js';
import {
  DuplicateVariantCodeError,
  VariantNotFoundError,
} from '../../domain/errors/WarehouseErrors.js';
import type { VariantStatus } from '../../domain/valueObjects/AuxStatuses.js';
import { toVariantDto, type VariantDto } from '../dto/AuxDtos.js';
import type { Clock } from '../ports/Clock.js';
import type { NewVariantInput, VariantRepository } from '../ports/VariantRepository.js';

export interface CreateVariantInput {
  companyId: number;
  code: string;
  name: string;
  status?: VariantStatus;
  options?: ReadonlyArray<VariantOption>;
}

export class CreateVariantUseCase {
  constructor(private readonly variants: VariantRepository) {}

  async execute(input: CreateVariantInput): Promise<VariantDto> {
    const code = input.code.trim();
    if (await this.variants.existsByCode(input.companyId, code)) {
      throw new DuplicateVariantCodeError(code);
    }
    const toInsert: NewVariantInput = {
      companyId: input.companyId,
      code,
      name: input.name.trim(),
      status: input.status ?? 'active',
      options: input.options ?? [],
    };
    const created = await this.variants.insert(toInsert);
    return toVariantDto(created);
  }
}

export interface UpdateVariantInput {
  companyId: number;
  variantId: number;
  code?: string;
  name?: string;
  status?: VariantStatus;
  options?: ReadonlyArray<VariantOption>;
}

export class UpdateVariantUseCase {
  constructor(
    private readonly variants: VariantRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateVariantInput): Promise<VariantDto> {
    const existing = await this.variants.findById(input.variantId, input.companyId);
    if (!existing) {
      throw new VariantNotFoundError(input.variantId);
    }
    if (input.code !== undefined) {
      const code = input.code.trim();
      if (
        code !== existing.code &&
        (await this.variants.existsByCode(input.companyId, code, input.variantId))
      ) {
        throw new DuplicateVariantCodeError(code);
      }
    }
    const updated = existing.withUpdates(
      {
        ...(input.code !== undefined ? { code: input.code.trim() } : {}),
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.options !== undefined ? { options: input.options } : {}),
      },
      this.clock.now(),
    );
    await this.variants.update(updated);
    return toVariantDto(updated);
  }
}

export class DeleteVariantUseCase {
  constructor(private readonly variants: VariantRepository) {}

  async execute(input: { companyId: number; variantId: number }): Promise<{ ok: true }> {
    const existing = await this.variants.findById(input.variantId, input.companyId);
    if (!existing) {
      throw new VariantNotFoundError(input.variantId);
    }
    await this.variants.remove(input.variantId, input.companyId);
    return { ok: true };
  }
}

export class ListVariantsUseCase {
  constructor(private readonly variants: VariantRepository) {}

  async execute(input: { companyId: number; status?: VariantStatus }): Promise<VariantDto[]> {
    const list = await this.variants.listByCompany(input.companyId, {
      ...(input.status !== undefined ? { status: input.status } : {}),
    });
    return list.map(toVariantDto);
  }
}

export class GetVariantUseCase {
  constructor(private readonly variants: VariantRepository) {}

  async execute(input: { companyId: number; variantId: number }): Promise<VariantDto> {
    const v = await this.variants.findById(input.variantId, input.companyId);
    if (!v) {
      throw new VariantNotFoundError(input.variantId);
    }
    return toVariantDto(v);
  }
}
