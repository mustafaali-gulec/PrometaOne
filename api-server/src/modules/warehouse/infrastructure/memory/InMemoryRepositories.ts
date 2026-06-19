/**
 * In-memory warehouse repository'leri — test/dev için.
 *
 * Pg* repository'lerin sözleşmesini taklit eder (finance __tests__/fakes.ts
 * deseni). companyId izolasyonu her sorguda uygulanır.
 *
 * Bu test double'lar async port sözleşmesini senkron implemente eder; bu yüzden
 * require-await bu dosyada kapatılır (finance fakes __tests__ altında olduğu için
 * kuraldan muaftı; buradaki dosya production yolunda olduğundan açıkça kapatılır).
 */
/* eslint-disable @typescript-eslint/require-await */
import type { Clock } from '../../application/ports/Clock.js';
import type {
  MaterialRepository,
  NewMaterialInput,
} from '../../application/ports/MaterialRepository.js';
import type {
  MovementFilter,
  StockMovementRepository,
} from '../../application/ports/StockMovementRepository.js';
import type {
  NewWarehouseInput,
  WarehouseRepository,
} from '../../application/ports/WarehouseRepository.js';
import { Material } from '../../domain/entities/Material.js';
import type { StockMovement } from '../../domain/entities/StockMovement.js';
import { Warehouse } from '../../domain/entities/Warehouse.js';
import type { MaterialStatus } from '../../domain/valueObjects/MaterialEnums.js';
import type { MovementKind } from '../../domain/valueObjects/MovementKind.js';
import type { WarehouseStatus } from '../../domain/valueObjects/WarehouseStatus.js';

const NOW = new Date('2026-01-01T00:00:00Z');

export class FixedClock implements Clock {
  constructor(private readonly fixed: Date = NOW) {}
  now(): Date {
    return this.fixed;
  }
}

export class InMemoryWarehouseRepository implements WarehouseRepository {
  private seq = 0;
  private readonly store = new Map<number, Warehouse>();

  async insert(input: NewWarehouseInput): Promise<Warehouse> {
    this.seq += 1;
    const w = Warehouse.create({
      id: this.seq,
      companyId: input.companyId,
      code: input.code,
      name: input.name,
      unitName: input.unitName,
      city: input.city,
      district: input.district,
      address: input.address,
      manager: input.manager,
      status: input.status,
      locations: input.locations.map((l) => ({ ...l })),
      createdAt: NOW,
      updatedAt: NOW,
    });
    this.store.set(w.id, w);
    return w;
  }

  async update(warehouse: Warehouse): Promise<void> {
    this.store.set(warehouse.id, warehouse);
  }

  async remove(id: number, companyId: number): Promise<void> {
    const w = this.store.get(id);
    if (w && w.companyId === companyId) {
      this.store.delete(id);
    }
  }

  async findById(id: number, companyId: number): Promise<Warehouse | null> {
    const w = this.store.get(id);
    return w && w.companyId === companyId ? w : null;
  }

  async existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean> {
    return [...this.store.values()].some(
      (w) =>
        w.companyId === companyId &&
        w.code.toLowerCase() === code.toLowerCase() &&
        w.id !== excludeId,
    );
  }

  async listByCompany(
    companyId: number,
    options?: { status?: WarehouseStatus },
  ): Promise<ReadonlyArray<Warehouse>> {
    return [...this.store.values()].filter(
      (w) =>
        w.companyId === companyId && (options?.status === undefined || w.status === options.status),
    );
  }
}

export class InMemoryMaterialRepository implements MaterialRepository {
  private seq = 0;
  private readonly store = new Map<number, Material>();

  async insert(input: NewMaterialInput): Promise<Material> {
    this.seq += 1;
    const m = Material.create({
      id: this.seq,
      companyId: input.companyId,
      code: input.code,
      name: input.name,
      groupId: input.groupId,
      type: input.type,
      baseUnit: input.baseUnit,
      altUnits: input.altUnits.map((u) => ({ ...u })),
      brand: input.brand,
      barcode: input.barcode,
      producerCode: input.producerCode,
      gtip: input.gtip,
      abc: input.abc,
      trackMethod: input.trackMethod,
      costMethod: input.costMethod,
      negativeControl: input.negativeControl,
      minStock: input.minStock,
      maxStock: input.maxStock,
      safetyStock: input.safetyStock,
      shelfLifeMonths: input.shelfLifeMonths,
      perishable: input.perishable,
      fragile: input.fragile,
      kdvPurchase: input.kdvPurchase,
      kdvSale: input.kdvSale,
      tevkifatCode: input.tevkifatCode,
      extraTaxRate: input.extraTaxRate,
      whParams: input.whParams.map((p) => ({ ...p })),
      status: input.status,
      createdAt: NOW,
      updatedAt: NOW,
    });
    this.store.set(m.id, m);
    return m;
  }

  async update(material: Material): Promise<void> {
    this.store.set(material.id, material);
  }

  async remove(id: number, companyId: number): Promise<void> {
    const m = this.store.get(id);
    if (m && m.companyId === companyId) {
      this.store.delete(id);
    }
  }

  async findById(id: number, companyId: number): Promise<Material | null> {
    const m = this.store.get(id);
    return m && m.companyId === companyId ? m : null;
  }

  async existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean> {
    return [...this.store.values()].some(
      (m) =>
        m.companyId === companyId &&
        m.code.toLowerCase() === code.toLowerCase() &&
        m.id !== excludeId,
    );
  }

  async listByCompany(
    companyId: number,
    options?: { status?: MaterialStatus; groupId?: number; search?: string },
  ): Promise<ReadonlyArray<Material>> {
    const q = options?.search?.toLowerCase();
    return [...this.store.values()].filter(
      (m) =>
        m.companyId === companyId &&
        (options?.status === undefined || m.status === options.status) &&
        (options?.groupId === undefined || m.groupId === options.groupId) &&
        (q === undefined || m.code.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)),
    );
  }
}

export class InMemoryStockMovementRepository implements StockMovementRepository {
  private seq = 0;
  private store: StockMovement[] = [];

  async insert(movement: StockMovement): Promise<StockMovement> {
    this.seq += 1;
    const persisted = movement.withId(this.seq);
    this.store.push(persisted);
    return persisted;
  }

  async findById(id: number, companyId: number): Promise<StockMovement | null> {
    return this.store.find((m) => m.id === id && m.companyId === companyId) ?? null;
  }

  async list(companyId: number, filter?: MovementFilter): Promise<ReadonlyArray<StockMovement>> {
    return this.store
      .filter((m) => {
        if (m.companyId !== companyId) return false;
        if (filter?.materialId !== undefined && m.materialId !== filter.materialId) return false;
        if (filter?.kind !== undefined && m.kind !== filter.kind) return false;
        if (filter?.warehouseId !== undefined && !touchesWarehouse(m, filter.warehouseId)) {
          return false;
        }
        if (filter?.dateFrom !== undefined && m.date < filter.dateFrom) return false;
        if (filter?.dateTo !== undefined && m.date > filter.dateTo) return false;
        return true;
      })
      .sort(byDateThenId);
  }

  async listByMaterial(
    companyId: number,
    materialId: number,
  ): Promise<ReadonlyArray<StockMovement>> {
    return this.store
      .filter((m) => m.companyId === companyId && m.materialId === materialId)
      .sort(byDateThenId);
  }

  async warehouseHasMovements(companyId: number, warehouseId: number): Promise<boolean> {
    return this.store.some((m) => m.companyId === companyId && touchesWarehouse(m, warehouseId));
  }

  async materialHasMovements(companyId: number, materialId: number): Promise<boolean> {
    return this.store.some((m) => m.companyId === companyId && m.materialId === materialId);
  }

  async nextSequence(companyId: number, kind: MovementKind, year: number): Promise<number> {
    const prefix = `${year}-`;
    const count = this.store.filter(
      (m) => m.companyId === companyId && m.kind === kind && m.date.startsWith(prefix),
    ).length;
    return count + 1;
  }
}

function touchesWarehouse(m: StockMovement, warehouseId: number): boolean {
  return (
    m.warehouseId === warehouseId ||
    m.fromWarehouseId === warehouseId ||
    m.toWarehouseId === warehouseId
  );
}

function byDateThenId(a: StockMovement, b: StockMovement): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return (a.id ?? 0) - (b.id ?? 0);
}
