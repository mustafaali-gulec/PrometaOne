/**
 * Depo (Warehouse) use-case'leri — create/update/delete/list/get.
 *
 * delete: bağlı stok hareketi varsa engellenir (WarehouseHasMovementsError).
 */
import type { WarehouseLocation } from '../../domain/entities/Warehouse.js';
import {
  DuplicateWarehouseCodeError,
  WarehouseHasMovementsError,
  WarehouseNotFoundError,
} from '../../domain/errors/WarehouseErrors.js';
import type { WarehouseStatus } from '../../domain/valueObjects/WarehouseStatus.js';
import { toWarehouseDto, type WarehouseDto } from '../dto/WarehouseDtos.js';
import type { Clock } from '../ports/Clock.js';
import type { StockMovementRepository } from '../ports/StockMovementRepository.js';
import type { NewWarehouseInput, WarehouseRepository } from '../ports/WarehouseRepository.js';

export interface CreateWarehouseInput {
  companyId: number;
  code: string;
  name: string;
  unitName?: string | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  manager?: string | null;
  status?: WarehouseStatus;
  locations?: ReadonlyArray<WarehouseLocation>;
}

export class CreateWarehouseUseCase {
  constructor(private readonly warehouses: WarehouseRepository) {}

  async execute(input: CreateWarehouseInput): Promise<WarehouseDto> {
    const code = input.code.trim();
    if (await this.warehouses.existsByCode(input.companyId, code)) {
      throw new DuplicateWarehouseCodeError(code);
    }
    const toInsert: NewWarehouseInput = {
      companyId: input.companyId,
      code,
      name: input.name.trim(),
      unitName: input.unitName ?? null,
      city: input.city ?? null,
      district: input.district ?? null,
      address: input.address ?? null,
      manager: input.manager ?? null,
      status: input.status ?? 'active',
      locations: input.locations ?? [],
    };
    const created = await this.warehouses.insert(toInsert);
    return toWarehouseDto(created);
  }
}

export interface UpdateWarehouseInput {
  companyId: number;
  warehouseId: number;
  code?: string;
  name?: string;
  unitName?: string | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  manager?: string | null;
  status?: WarehouseStatus;
  locations?: ReadonlyArray<WarehouseLocation>;
}

export class UpdateWarehouseUseCase {
  constructor(
    private readonly warehouses: WarehouseRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateWarehouseInput): Promise<WarehouseDto> {
    const existing = await this.warehouses.findById(input.warehouseId, input.companyId);
    if (!existing) {
      throw new WarehouseNotFoundError(input.warehouseId);
    }
    if (input.code !== undefined) {
      const code = input.code.trim();
      if (
        code !== existing.code &&
        (await this.warehouses.existsByCode(input.companyId, code, input.warehouseId))
      ) {
        throw new DuplicateWarehouseCodeError(code);
      }
    }
    const updated = existing.withUpdates(
      {
        ...(input.code !== undefined ? { code: input.code.trim() } : {}),
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.unitName !== undefined ? { unitName: input.unitName } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.district !== undefined ? { district: input.district } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.manager !== undefined ? { manager: input.manager } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.locations !== undefined ? { locations: input.locations } : {}),
      },
      this.clock.now(),
    );
    await this.warehouses.update(updated);
    return toWarehouseDto(updated);
  }
}

export class DeleteWarehouseUseCase {
  constructor(
    private readonly warehouses: WarehouseRepository,
    private readonly movements: StockMovementRepository,
  ) {}

  async execute(input: { companyId: number; warehouseId: number }): Promise<{ ok: true }> {
    const existing = await this.warehouses.findById(input.warehouseId, input.companyId);
    if (!existing) {
      throw new WarehouseNotFoundError(input.warehouseId);
    }
    if (await this.movements.warehouseHasMovements(input.companyId, input.warehouseId)) {
      throw new WarehouseHasMovementsError(input.warehouseId);
    }
    await this.warehouses.remove(input.warehouseId, input.companyId);
    return { ok: true };
  }
}

export class ListWarehousesUseCase {
  constructor(private readonly warehouses: WarehouseRepository) {}

  async execute(input: { companyId: number; status?: WarehouseStatus }): Promise<WarehouseDto[]> {
    const list = await this.warehouses.listByCompany(input.companyId, {
      ...(input.status !== undefined ? { status: input.status } : {}),
    });
    return list.map(toWarehouseDto);
  }
}

export class GetWarehouseUseCase {
  constructor(private readonly warehouses: WarehouseRepository) {}

  async execute(input: { companyId: number; warehouseId: number }): Promise<WarehouseDto> {
    const w = await this.warehouses.findById(input.warehouseId, input.companyId);
    if (!w) {
      throw new WarehouseNotFoundError(input.warehouseId);
    }
    return toWarehouseDto(w);
  }
}
