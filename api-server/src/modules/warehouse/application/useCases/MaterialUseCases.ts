/**
 * Malzeme (Material) use-case'leri — CRUD.
 *
 * delete: bağlı stok hareketi varsa engellenir (MaterialHasMovementsError).
 */
import type { MaterialAltUnit, MaterialWhParam } from '../../domain/entities/Material.js';
import {
  DuplicateMaterialCodeError,
  MaterialHasMovementsError,
  MaterialNotFoundError,
} from '../../domain/errors/WarehouseErrors.js';
import type {
  AbcClass,
  CostMethod,
  MaterialStatus,
  NegativeControl,
  TrackMethod,
} from '../../domain/valueObjects/MaterialEnums.js';
import { toMaterialDto, type MaterialDto } from '../dto/MaterialDtos.js';
import type { Clock } from '../ports/Clock.js';
import type { MaterialRepository, NewMaterialInput } from '../ports/MaterialRepository.js';
import type { StockMovementRepository } from '../ports/StockMovementRepository.js';

export interface CreateMaterialInput {
  companyId: number;
  code: string;
  name: string;
  baseUnit: string;
  groupId?: number | null;
  type?: string | null;
  altUnits?: ReadonlyArray<MaterialAltUnit>;
  brand?: string | null;
  barcode?: string | null;
  producerCode?: string | null;
  gtip?: string | null;
  abc?: AbcClass | null;
  trackMethod?: TrackMethod;
  costMethod?: CostMethod;
  negativeControl?: NegativeControl;
  minStock?: number | null;
  maxStock?: number | null;
  safetyStock?: number | null;
  shelfLifeMonths?: number | null;
  perishable?: boolean;
  fragile?: boolean;
  kdvPurchase?: number | null;
  kdvSale?: number | null;
  tevkifatCode?: string | null;
  extraTaxRate?: number | null;
  whParams?: ReadonlyArray<MaterialWhParam>;
  status?: MaterialStatus;
}

export class CreateMaterialUseCase {
  constructor(private readonly materials: MaterialRepository) {}

  async execute(input: CreateMaterialInput): Promise<MaterialDto> {
    const code = input.code.trim();
    if (await this.materials.existsByCode(input.companyId, code)) {
      throw new DuplicateMaterialCodeError(code);
    }
    const toInsert: NewMaterialInput = {
      companyId: input.companyId,
      code,
      name: input.name.trim(),
      baseUnit: input.baseUnit.trim(),
      groupId: input.groupId ?? null,
      type: input.type ?? null,
      altUnits: input.altUnits ?? [],
      brand: input.brand ?? null,
      barcode: input.barcode ?? null,
      producerCode: input.producerCode ?? null,
      gtip: input.gtip ?? null,
      abc: input.abc ?? null,
      trackMethod: input.trackMethod ?? 'none',
      costMethod: input.costMethod ?? 'avg',
      negativeControl: input.negativeControl ?? 'block',
      minStock: input.minStock ?? null,
      maxStock: input.maxStock ?? null,
      safetyStock: input.safetyStock ?? null,
      shelfLifeMonths: input.shelfLifeMonths ?? null,
      perishable: input.perishable ?? false,
      fragile: input.fragile ?? false,
      kdvPurchase: input.kdvPurchase ?? null,
      kdvSale: input.kdvSale ?? null,
      tevkifatCode: input.tevkifatCode ?? null,
      extraTaxRate: input.extraTaxRate ?? null,
      whParams: input.whParams ?? [],
      status: input.status ?? 'active',
    };
    const created = await this.materials.insert(toInsert);
    return toMaterialDto(created);
  }
}

export interface UpdateMaterialInput {
  companyId: number;
  materialId: number;
  code?: string;
  name?: string;
  baseUnit?: string;
  groupId?: number | null;
  type?: string | null;
  altUnits?: ReadonlyArray<MaterialAltUnit>;
  brand?: string | null;
  barcode?: string | null;
  producerCode?: string | null;
  gtip?: string | null;
  abc?: AbcClass | null;
  trackMethod?: TrackMethod;
  costMethod?: CostMethod;
  negativeControl?: NegativeControl;
  minStock?: number | null;
  maxStock?: number | null;
  safetyStock?: number | null;
  shelfLifeMonths?: number | null;
  perishable?: boolean;
  fragile?: boolean;
  kdvPurchase?: number | null;
  kdvSale?: number | null;
  tevkifatCode?: string | null;
  extraTaxRate?: number | null;
  whParams?: ReadonlyArray<MaterialWhParam>;
  status?: MaterialStatus;
}

export class UpdateMaterialUseCase {
  constructor(
    private readonly materials: MaterialRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateMaterialInput): Promise<MaterialDto> {
    const existing = await this.materials.findById(input.materialId, input.companyId);
    if (!existing) {
      throw new MaterialNotFoundError(input.materialId);
    }
    if (input.code !== undefined) {
      const code = input.code.trim();
      if (
        code !== existing.code &&
        (await this.materials.existsByCode(input.companyId, code, input.materialId))
      ) {
        throw new DuplicateMaterialCodeError(code);
      }
    }
    const updated = existing.withUpdates(
      {
        ...(input.code !== undefined ? { code: input.code.trim() } : {}),
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.baseUnit !== undefined ? { baseUnit: input.baseUnit.trim() } : {}),
        ...(input.groupId !== undefined ? { groupId: input.groupId } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.altUnits !== undefined ? { altUnits: input.altUnits } : {}),
        ...(input.brand !== undefined ? { brand: input.brand } : {}),
        ...(input.barcode !== undefined ? { barcode: input.barcode } : {}),
        ...(input.producerCode !== undefined ? { producerCode: input.producerCode } : {}),
        ...(input.gtip !== undefined ? { gtip: input.gtip } : {}),
        ...(input.abc !== undefined ? { abc: input.abc } : {}),
        ...(input.trackMethod !== undefined ? { trackMethod: input.trackMethod } : {}),
        ...(input.costMethod !== undefined ? { costMethod: input.costMethod } : {}),
        ...(input.negativeControl !== undefined ? { negativeControl: input.negativeControl } : {}),
        ...(input.minStock !== undefined ? { minStock: input.minStock } : {}),
        ...(input.maxStock !== undefined ? { maxStock: input.maxStock } : {}),
        ...(input.safetyStock !== undefined ? { safetyStock: input.safetyStock } : {}),
        ...(input.shelfLifeMonths !== undefined ? { shelfLifeMonths: input.shelfLifeMonths } : {}),
        ...(input.perishable !== undefined ? { perishable: input.perishable } : {}),
        ...(input.fragile !== undefined ? { fragile: input.fragile } : {}),
        ...(input.kdvPurchase !== undefined ? { kdvPurchase: input.kdvPurchase } : {}),
        ...(input.kdvSale !== undefined ? { kdvSale: input.kdvSale } : {}),
        ...(input.tevkifatCode !== undefined ? { tevkifatCode: input.tevkifatCode } : {}),
        ...(input.extraTaxRate !== undefined ? { extraTaxRate: input.extraTaxRate } : {}),
        ...(input.whParams !== undefined ? { whParams: input.whParams } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      this.clock.now(),
    );
    await this.materials.update(updated);
    return toMaterialDto(updated);
  }
}

export class DeleteMaterialUseCase {
  constructor(
    private readonly materials: MaterialRepository,
    private readonly movements: StockMovementRepository,
  ) {}

  async execute(input: { companyId: number; materialId: number }): Promise<{ ok: true }> {
    const existing = await this.materials.findById(input.materialId, input.companyId);
    if (!existing) {
      throw new MaterialNotFoundError(input.materialId);
    }
    if (await this.movements.materialHasMovements(input.companyId, input.materialId)) {
      throw new MaterialHasMovementsError(input.materialId);
    }
    await this.materials.remove(input.materialId, input.companyId);
    return { ok: true };
  }
}

export class ListMaterialsUseCase {
  constructor(private readonly materials: MaterialRepository) {}

  async execute(input: {
    companyId: number;
    status?: MaterialStatus;
    groupId?: number;
    search?: string;
  }): Promise<MaterialDto[]> {
    const list = await this.materials.listByCompany(input.companyId, {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.groupId !== undefined ? { groupId: input.groupId } : {}),
      ...(input.search !== undefined ? { search: input.search } : {}),
    });
    return list.map(toMaterialDto);
  }
}

export class GetMaterialUseCase {
  constructor(private readonly materials: MaterialRepository) {}

  async execute(input: { companyId: number; materialId: number }): Promise<MaterialDto> {
    const m = await this.materials.findById(input.materialId, input.companyId);
    if (!m) {
      throw new MaterialNotFoundError(input.materialId);
    }
    return toMaterialDto(m);
  }
}
