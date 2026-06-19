/**
 * Envanter Sayım (InventoryCount) use-case'leri.
 *
 *   create/update/list/get — CRUD (no: SAY-YYYY-NNNN)
 *   apply — open → applied:
 *             farklı (countedQty ≠ systemQty) her kalem için `count` türünde
 *             stok hareketi yaratır. count hareketi qty>0 invariant'ı gerektirir;
 *             bu yüzden qty = |fark|, baseQty = işaretli fark olarak modellenir
 *             (StockMovement.signedDeltaFor 'count' → +baseQty döndürür).
 *
 * Hareket alan şekli RecordMovementUseCase ile aynı tutulur. count, warehouseId
 * tek-depolu hareket olarak sayımın deposuna işlenir.
 */
import type { InventoryCountItem } from '../../domain/entities/InventoryCount.js';
import type { Material } from '../../domain/entities/Material.js';
import { StockMovement } from '../../domain/entities/StockMovement.js';
import {
  EmptyItemsError,
  InventoryCountNotFoundError,
  InvalidWorkflowTransitionError,
  MaterialNotFoundError,
  WarehouseNotFoundError,
} from '../../domain/errors/WarehouseErrors.js';
import { formatAuxDocNo } from '../../domain/valueObjects/AuxDocKind.js';
import { MOVEMENT_NO_PREFIX } from '../../domain/valueObjects/MovementKind.js';
import { toInventoryCountDto, type InventoryCountDto } from '../dto/AuxDtos.js';
import type { Clock } from '../ports/Clock.js';
import type {
  InventoryCountRepository,
  NewInventoryCountInput,
} from '../ports/InventoryCountRepository.js';
import type { MaterialRepository } from '../ports/MaterialRepository.js';
import type { StockMovementRepository } from '../ports/StockMovementRepository.js';
import type { WarehouseRepository } from '../ports/WarehouseRepository.js';

interface InputItem {
  materialId: number;
  systemQty: number;
  countedQty: number;
}

export interface CreateInventoryCountInput {
  companyId: number;
  date: string;
  warehouseId: number;
  period?: string | null;
  items: ReadonlyArray<InputItem>;
}

export class CreateInventoryCountUseCase {
  constructor(
    private readonly counts: InventoryCountRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateInventoryCountInput): Promise<InventoryCountDto> {
    if (input.items.length === 0) {
      throw new EmptyItemsError('Envanter sayımı');
    }
    const year = parseYear(input.date) ?? this.clock.now().getUTCFullYear();
    const seq = await this.counts.nextSequence(input.companyId, year);
    const toInsert: NewInventoryCountInput = {
      companyId: input.companyId,
      no: formatAuxDocNo('count', year, seq),
      date: input.date,
      warehouseId: input.warehouseId,
      period: input.period ?? null,
      status: 'open',
      items: normalizeItems(input.items),
    };
    const created = await this.counts.insert(toInsert);
    return toInventoryCountDto(created);
  }
}

export interface UpdateInventoryCountInput {
  companyId: number;
  countId: number;
  date?: string;
  warehouseId?: number;
  period?: string | null;
  items?: ReadonlyArray<InputItem>;
}

export class UpdateInventoryCountUseCase {
  constructor(
    private readonly counts: InventoryCountRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateInventoryCountInput): Promise<InventoryCountDto> {
    const existing = await this.counts.findById(input.countId, input.companyId);
    if (!existing) {
      throw new InventoryCountNotFoundError(input.countId);
    }
    if (existing.status === 'applied') {
      throw new InvalidWorkflowTransitionError('Sayım', existing.status, 'düzenleme');
    }
    if (input.items !== undefined && input.items.length === 0) {
      throw new EmptyItemsError('Envanter sayımı');
    }
    const updated = existing.withUpdates(
      {
        ...(input.date !== undefined ? { date: input.date } : {}),
        ...(input.warehouseId !== undefined ? { warehouseId: input.warehouseId } : {}),
        ...(input.period !== undefined ? { period: input.period } : {}),
        ...(input.items !== undefined ? { items: normalizeItems(input.items) } : {}),
      },
      this.clock.now(),
    );
    await this.counts.update(updated);
    return toInventoryCountDto(updated);
  }
}

/**
 * Sayımı stoğa işler: farklı her kalem için `count` hareketi (işaretli baseQty)
 * yaratır, sonra status=applied yapar.
 */
export class ApplyInventoryCountUseCase {
  constructor(
    private readonly counts: InventoryCountRepository,
    private readonly materials: MaterialRepository,
    private readonly movements: StockMovementRepository,
    private readonly warehouses: WarehouseRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    companyId: number;
    countId: number;
    actorUserId?: number | null;
  }): Promise<InventoryCountDto> {
    const existing = await this.counts.findById(input.countId, input.companyId);
    if (!existing) {
      throw new InventoryCountNotFoundError(input.countId);
    }
    if (existing.status !== 'open') {
      throw new InvalidWorkflowTransitionError('Sayım', existing.status, 'stoğa işleme');
    }
    if (existing.items.length === 0) {
      throw new EmptyItemsError('Envanter sayımı');
    }

    const now = this.clock.now();
    const year = parseYear(existing.date) ?? now.getUTCFullYear();

    const wh = await this.warehouses.findById(existing.warehouseId, input.companyId);
    if (!wh) {
      throw new WarehouseNotFoundError(existing.warehouseId);
    }

    // Malzemeleri doğrula + cache (count hareketi baseUnit'i malzemeden alır).
    const materialById = new Map<number, Material>();
    for (const it of existing.items) {
      if (materialById.has(it.materialId)) continue;
      const material = await this.materials.findById(it.materialId, input.companyId);
      if (!material) {
        throw new MaterialNotFoundError(it.materialId);
      }
      materialById.set(it.materialId, material);
    }

    // Farklı kalemler için count hareketi üret.
    for (const it of existing.items) {
      const diff = round6(it.countedQty - it.systemQty);
      if (diff === 0) continue;
      const material = materialById.get(it.materialId)!;
      const seq = await this.movements.nextSequence(input.companyId, 'count', year);
      const no = `${MOVEMENT_NO_PREFIX.count}-${year}-${String(seq).padStart(4, '0')}`;
      const movement = StockMovement.create({
        id: null,
        companyId: input.companyId,
        no,
        kind: 'count',
        subType: diff > 0 ? 'sayim_fazlasi' : 'sayim_eksigi',
        date: existing.date,
        warehouseId: existing.warehouseId,
        fromWarehouseId: null,
        toWarehouseId: null,
        materialId: it.materialId,
        // qty entity invariant'ı > 0 ister: pozitif büyüklük; işaret baseQty'de.
        qty: Math.abs(diff),
        unit: material.baseUnit,
        factor: 1,
        baseUnit: material.baseUnit,
        baseQty: diff,
        unitPrice: null,
        unitCostBase: null,
        total: null,
        lots: [],
        locationId: null,
        partyId: null,
        person: null,
        docNo: existing.no,
        note: `Sayım düzeltme: ${existing.no}`,
        createdBy: input.actorUserId ?? null,
        createdAt: now,
      });
      await this.movements.insert(movement);
    }

    const updated = existing.withUpdates({ status: 'applied' }, now);
    await this.counts.update(updated);
    return toInventoryCountDto(updated);
  }
}

export class ListInventoryCountsUseCase {
  constructor(private readonly counts: InventoryCountRepository) {}

  async execute(input: {
    companyId: number;
    status?: InventoryCountDto['status'];
    warehouseId?: number;
  }): Promise<InventoryCountDto[]> {
    const list = await this.counts.listByCompany(input.companyId, {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.warehouseId !== undefined ? { warehouseId: input.warehouseId } : {}),
    });
    return list.map(toInventoryCountDto);
  }
}

export class GetInventoryCountUseCase {
  constructor(private readonly counts: InventoryCountRepository) {}

  async execute(input: { companyId: number; countId: number }): Promise<InventoryCountDto> {
    const c = await this.counts.findById(input.countId, input.companyId);
    if (!c) {
      throw new InventoryCountNotFoundError(input.countId);
    }
    return toInventoryCountDto(c);
  }
}

// --- yardımcılar ----------------------------------------------------------
function normalizeItems(items: ReadonlyArray<InputItem>): InventoryCountItem[] {
  return items.map((it) => ({
    materialId: it.materialId,
    systemQty: it.systemQty,
    countedQty: it.countedQty,
  }));
}

function parseYear(date: string): number | null {
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(date);
  return match && match[1] !== undefined ? Number(match[1]) : null;
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
