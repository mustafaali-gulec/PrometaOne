/**
 * Stok use-case'leri.
 *
 *  RecordMovementUseCase — in/out/transfer/count kaydı:
 *    - qty > 0 (entity invariant), birim → factor çözümü, baseQty = qty*factor
 *    - out/transfer: stoğu negatife düşüremez (material.negativeControl='allow'
 *      değilse) → InsufficientStockError
 *    - hareket no otomatik: GİR/ÇIK/TRF/SAY-YYYY-NNNN
 *  GetStockLevelsUseCase  — (material, warehouse) bazında base-birim stok
 *  GetMovementsUseCase    — filtreli hareket listesi
 *  GetMaterialLedgerUseCase — yürüyen bakiye (running balance)
 */
import { StockMovement, type MovementLot } from '../../domain/entities/StockMovement.js';
import {
  InsufficientStockError,
  InvalidMovementError,
  InvalidQuantityError,
  MaterialNotFoundError,
  WarehouseNotFoundError,
} from '../../domain/errors/WarehouseErrors.js';
import { StockLedger } from '../../domain/services/StockLedger.js';
import { MOVEMENT_NO_PREFIX, type MovementKind } from '../../domain/valueObjects/MovementKind.js';
import {
  toStockMovementDto,
  type MaterialLedgerRowDto,
  type StockLevelDto,
  type StockMovementDto,
} from '../dto/StockDtos.js';
import type { Clock } from '../ports/Clock.js';
import type { MaterialRepository } from '../ports/MaterialRepository.js';
import type { MovementFilter, StockMovementRepository } from '../ports/StockMovementRepository.js';
import type { WarehouseRepository } from '../ports/WarehouseRepository.js';

export interface RecordMovementInput {
  companyId: number;
  kind: MovementKind;
  subType?: string | null;
  date: string;
  warehouseId?: number | null;
  fromWarehouseId?: number | null;
  toWarehouseId?: number | null;
  materialId: number;
  qty: number;
  /** Birim; verilmezse malzemenin baseUnit'i kullanılır. */
  unit?: string;
  unitPrice?: number | null;
  unitCostBase?: number | null;
  lots?: ReadonlyArray<MovementLot>;
  locationId?: number | null;
  partyId?: number | null;
  person?: string | null;
  docNo?: string | null;
  note?: string | null;
  actorUserId?: number | null;
}

export class RecordMovementUseCase {
  constructor(
    private readonly movements: StockMovementRepository,
    private readonly materials: MaterialRepository,
    private readonly warehouses: WarehouseRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: RecordMovementInput): Promise<StockMovementDto> {
    if (input.qty <= 0) {
      throw new InvalidQuantityError('miktar 0 dan büyük olmalı');
    }

    const material = await this.materials.findById(input.materialId, input.companyId);
    if (!material) {
      throw new MaterialNotFoundError(input.materialId);
    }

    // Birim → factor çözümü (baseUnit veya tanımlı bir altUnit olmalı).
    const unit = input.unit ?? material.baseUnit;
    const factor = material.resolveFactor(unit);
    if (factor === null) {
      throw new InvalidMovementError(
        `malzeme#${material.id} için tanımsız birim: "${unit}" (base: ${material.baseUnit})`,
      );
    }
    const baseQty = round6(input.qty * factor);

    // İlgili depoların varlığını doğrula.
    const involvedWarehouses =
      input.kind === 'transfer'
        ? [input.fromWarehouseId, input.toWarehouseId]
        : [input.warehouseId];
    for (const wid of involvedWarehouses) {
      if (wid === null || wid === undefined) {
        throw new InvalidMovementError(`${input.kind} hareketi için depo zorunlu`);
      }
      const wh = await this.warehouses.findById(wid, input.companyId);
      if (!wh) {
        throw new WarehouseNotFoundError(wid);
      }
    }

    // Negatif stok kontrolü (out / transfer çıkış deposu).
    if (!material.allowsNegativeStock()) {
      if (input.kind === 'out' && input.warehouseId != null) {
        await this.assertSufficient(input.companyId, material.id, input.warehouseId, baseQty);
      } else if (input.kind === 'transfer' && input.fromWarehouseId != null) {
        await this.assertSufficient(input.companyId, material.id, input.fromWarehouseId, baseQty);
      }
    }

    // Hareket no üret: PREFIX-YYYY-NNNN
    const year = parseYear(input.date) ?? this.clock.now().getUTCFullYear();
    const seq = await this.movements.nextSequence(input.companyId, input.kind, year);
    const no = `${MOVEMENT_NO_PREFIX[input.kind]}-${year}-${String(seq).padStart(4, '0')}`;

    const unitPrice = input.unitPrice ?? null;
    const total = unitPrice !== null ? round2(unitPrice * input.qty) : null;

    const movement = StockMovement.create({
      id: null,
      companyId: input.companyId,
      no,
      kind: input.kind,
      subType: input.subType ?? null,
      date: input.date,
      warehouseId: input.kind === 'transfer' ? null : (input.warehouseId ?? null),
      fromWarehouseId: input.kind === 'transfer' ? (input.fromWarehouseId ?? null) : null,
      toWarehouseId: input.kind === 'transfer' ? (input.toWarehouseId ?? null) : null,
      materialId: material.id,
      qty: input.qty,
      unit,
      factor,
      baseUnit: material.baseUnit,
      baseQty,
      unitPrice,
      unitCostBase: input.unitCostBase ?? null,
      total,
      lots: input.lots ?? [],
      locationId: input.locationId ?? null,
      partyId: input.partyId ?? null,
      person: input.person ?? null,
      docNo: input.docNo ?? null,
      note: input.note ?? null,
      createdBy: input.actorUserId ?? null,
      createdAt: this.clock.now(),
    });

    const persisted = await this.movements.insert(movement);
    return toStockMovementDto(persisted);
  }

  private async assertSufficient(
    companyId: number,
    materialId: number,
    warehouseId: number,
    requestedBaseQty: number,
  ): Promise<void> {
    const existing = await this.movements.listByMaterial(companyId, materialId);
    const current = StockLedger.computeStockFor(existing, materialId, warehouseId);
    if (current < requestedBaseQty) {
      throw new InsufficientStockError(
        materialId,
        warehouseId,
        String(round6(current)),
        String(round6(requestedBaseQty)),
      );
    }
  }
}

export class GetStockLevelsUseCase {
  constructor(
    private readonly movements: StockMovementRepository,
    private readonly materials: MaterialRepository,
  ) {}

  async execute(input: {
    companyId: number;
    materialId?: number;
    warehouseId?: number;
  }): Promise<StockLevelDto[]> {
    const filter: MovementFilter = {
      ...(input.materialId !== undefined ? { materialId: input.materialId } : {}),
      ...(input.warehouseId !== undefined ? { warehouseId: input.warehouseId } : {}),
    };
    const movements = await this.movements.list(input.companyId, filter);
    const levels = StockLedger.computeStockLevels(movements);

    // baseUnit'i malzemeden zenginleştir (tek sorgu cache).
    const baseUnitByMaterial = new Map<number, string>();
    const result: StockLevelDto[] = [];
    for (const lvl of levels) {
      if (input.warehouseId !== undefined && lvl.warehouseId !== input.warehouseId) {
        continue;
      }
      if (input.materialId !== undefined && lvl.materialId !== input.materialId) {
        continue;
      }
      let baseUnit = baseUnitByMaterial.get(lvl.materialId);
      if (baseUnit === undefined) {
        const m = await this.materials.findById(lvl.materialId, input.companyId);
        baseUnit = m?.baseUnit ?? '';
        baseUnitByMaterial.set(lvl.materialId, baseUnit);
      }
      result.push({
        materialId: lvl.materialId,
        warehouseId: lvl.warehouseId,
        baseUnit,
        baseQty: round6(lvl.baseQty),
      });
    }
    return result;
  }
}

export class GetMovementsUseCase {
  constructor(private readonly movements: StockMovementRepository) {}

  async execute(input: {
    companyId: number;
    materialId?: number;
    warehouseId?: number;
    kind?: MovementKind;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<StockMovementDto[]> {
    const filter: MovementFilter = {
      ...(input.materialId !== undefined ? { materialId: input.materialId } : {}),
      ...(input.warehouseId !== undefined ? { warehouseId: input.warehouseId } : {}),
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
      ...(input.dateFrom !== undefined ? { dateFrom: input.dateFrom } : {}),
      ...(input.dateTo !== undefined ? { dateTo: input.dateTo } : {}),
    };
    const list = await this.movements.list(input.companyId, filter);
    return list.map(toStockMovementDto);
  }
}

export class GetMaterialLedgerUseCase {
  constructor(
    private readonly movements: StockMovementRepository,
    private readonly materials: MaterialRepository,
  ) {}

  async execute(input: {
    companyId: number;
    materialId: number;
    /** Verilirse yalnız bu depoya ait yürüyen bakiye; verilmezse firma geneli. */
    warehouseId?: number;
  }): Promise<{ materialId: number; baseUnit: string; rows: MaterialLedgerRowDto[] }> {
    const material = await this.materials.findById(input.materialId, input.companyId);
    if (!material) {
      throw new MaterialNotFoundError(input.materialId);
    }
    const all = await this.movements.listByMaterial(input.companyId, input.materialId);
    const ordered = [...all].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (a.id ?? 0) - (b.id ?? 0);
    });

    let running = 0;
    const rows: MaterialLedgerRowDto[] = [];
    for (const m of ordered) {
      const delta =
        input.warehouseId !== undefined ? m.signedDeltaFor(input.warehouseId) : totalDelta(m);
      running = round6(running + delta);
      rows.push({
        movementId: m.id,
        no: m.no,
        date: m.date,
        kind: m.kind,
        warehouseId: m.warehouseId,
        fromWarehouseId: m.fromWarehouseId,
        toWarehouseId: m.toWarehouseId,
        delta: round6(delta),
        runningBalance: running,
        note: m.note,
      });
    }
    return { materialId: input.materialId, baseUnit: material.baseUnit, rows };
  }
}

// --- yardımcılar ----------------------------------------------------------
/** Firma geneli net delta (transfer 0 — toplam değişmez). */
function totalDelta(m: StockMovement): number {
  switch (m.kind) {
    case 'in':
      return m.baseQty;
    case 'out':
      return -m.baseQty;
    case 'count':
      return m.baseQty;
    case 'transfer':
      return 0;
    default:
      return 0;
  }
}

function parseYear(date: string): number | null {
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(date);
  return match && match[1] !== undefined ? Number(match[1]) : null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
