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
import type {
  AssignmentRepository,
  NewAssignmentInput,
} from '../../application/ports/AssignmentRepository.js';
import type { Clock } from '../../application/ports/Clock.js';
import type {
  InventoryCountRepository,
  NewInventoryCountInput,
} from '../../application/ports/InventoryCountRepository.js';
import type {
  MaterialGroupRepository,
  NewMaterialGroupInput,
} from '../../application/ports/MaterialGroupRepository.js';
import type {
  MaterialRepository,
  NewMaterialInput,
} from '../../application/ports/MaterialRepository.js';
import type {
  MaterialRequestRepository,
  NewMaterialRequestInput,
} from '../../application/ports/MaterialRequestRepository.js';
import type {
  MovementFilter,
  StockMovementRepository,
} from '../../application/ports/StockMovementRepository.js';
import type { NewUnitInput, UnitRepository } from '../../application/ports/UnitRepository.js';
import type {
  NewVariantInput,
  VariantRepository,
} from '../../application/ports/VariantRepository.js';
import type {
  NewWarehouseInput,
  WarehouseRepository,
} from '../../application/ports/WarehouseRepository.js';
import { Assignment } from '../../domain/entities/Assignment.js';
import { InventoryCount } from '../../domain/entities/InventoryCount.js';
import { Material } from '../../domain/entities/Material.js';
import { MaterialGroup } from '../../domain/entities/MaterialGroup.js';
import { MaterialRequest } from '../../domain/entities/MaterialRequest.js';
import type { StockMovement } from '../../domain/entities/StockMovement.js';
import { Unit } from '../../domain/entities/Unit.js';
import { Variant } from '../../domain/entities/Variant.js';
import { Warehouse } from '../../domain/entities/Warehouse.js';
import type {
  AssignmentStatus,
  GroupStatus,
  InventoryCountStatus,
  MaterialRequestStatus,
  VariantStatus,
} from '../../domain/valueObjects/AuxStatuses.js';
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
      purchasePrice: input.purchasePrice,
      salePrice: input.salePrice,
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

// --- Aux (yardımcı) entity repository'leri --------------------------------

export class InMemoryMaterialGroupRepository implements MaterialGroupRepository {
  private seq = 0;
  private readonly store = new Map<number, MaterialGroup>();

  async insert(input: NewMaterialGroupInput): Promise<MaterialGroup> {
    this.seq += 1;
    const g = MaterialGroup.create({
      id: this.seq,
      companyId: input.companyId,
      code: input.code,
      name: input.name,
      status: input.status,
      createdAt: NOW,
      updatedAt: NOW,
    });
    this.store.set(g.id, g);
    return g;
  }

  async update(group: MaterialGroup): Promise<void> {
    this.store.set(group.id, group);
  }

  async remove(id: number, companyId: number): Promise<void> {
    const g = this.store.get(id);
    if (g && g.companyId === companyId) {
      this.store.delete(id);
    }
  }

  async findById(id: number, companyId: number): Promise<MaterialGroup | null> {
    const g = this.store.get(id);
    return g && g.companyId === companyId ? g : null;
  }

  async existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean> {
    return [...this.store.values()].some(
      (g) =>
        g.companyId === companyId &&
        g.code.toLowerCase() === code.toLowerCase() &&
        g.id !== excludeId,
    );
  }

  async listByCompany(
    companyId: number,
    options?: { status?: GroupStatus },
  ): Promise<ReadonlyArray<MaterialGroup>> {
    return [...this.store.values()].filter(
      (g) =>
        g.companyId === companyId && (options?.status === undefined || g.status === options.status),
    );
  }
}

export class InMemoryUnitRepository implements UnitRepository {
  private seq = 0;
  private readonly store = new Map<number, Unit>();

  async insert(input: NewUnitInput): Promise<Unit> {
    this.seq += 1;
    const u = Unit.create({
      id: this.seq,
      companyId: input.companyId,
      code: input.code,
      name: input.name,
      createdAt: NOW,
      updatedAt: NOW,
    });
    this.store.set(u.id, u);
    return u;
  }

  async update(unit: Unit): Promise<void> {
    this.store.set(unit.id, unit);
  }

  async remove(id: number, companyId: number): Promise<void> {
    const u = this.store.get(id);
    if (u && u.companyId === companyId) {
      this.store.delete(id);
    }
  }

  async findById(id: number, companyId: number): Promise<Unit | null> {
    const u = this.store.get(id);
    return u && u.companyId === companyId ? u : null;
  }

  async existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean> {
    return [...this.store.values()].some(
      (u) =>
        u.companyId === companyId &&
        u.code.toLowerCase() === code.toLowerCase() &&
        u.id !== excludeId,
    );
  }

  async listByCompany(companyId: number): Promise<ReadonlyArray<Unit>> {
    return [...this.store.values()].filter((u) => u.companyId === companyId);
  }
}

export class InMemoryVariantRepository implements VariantRepository {
  private seq = 0;
  private readonly store = new Map<number, Variant>();

  async insert(input: NewVariantInput): Promise<Variant> {
    this.seq += 1;
    const v = Variant.create({
      id: this.seq,
      companyId: input.companyId,
      code: input.code,
      name: input.name,
      status: input.status,
      options: input.options.map((o) => ({ ...o })),
      createdAt: NOW,
      updatedAt: NOW,
    });
    this.store.set(v.id, v);
    return v;
  }

  async update(variant: Variant): Promise<void> {
    this.store.set(variant.id, variant);
  }

  async remove(id: number, companyId: number): Promise<void> {
    const v = this.store.get(id);
    if (v && v.companyId === companyId) {
      this.store.delete(id);
    }
  }

  async findById(id: number, companyId: number): Promise<Variant | null> {
    const v = this.store.get(id);
    return v && v.companyId === companyId ? v : null;
  }

  async existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean> {
    return [...this.store.values()].some(
      (v) =>
        v.companyId === companyId &&
        v.code.toLowerCase() === code.toLowerCase() &&
        v.id !== excludeId,
    );
  }

  async listByCompany(
    companyId: number,
    options?: { status?: VariantStatus },
  ): Promise<ReadonlyArray<Variant>> {
    return [...this.store.values()].filter(
      (v) =>
        v.companyId === companyId && (options?.status === undefined || v.status === options.status),
    );
  }
}

export class InMemoryMaterialRequestRepository implements MaterialRequestRepository {
  private seq = 0;
  private readonly store = new Map<number, MaterialRequest>();

  async insert(input: NewMaterialRequestInput): Promise<MaterialRequest> {
    this.seq += 1;
    const r = MaterialRequest.create({
      id: this.seq,
      companyId: input.companyId,
      no: input.no,
      date: input.date,
      requesterUnit: input.requesterUnit,
      requester: input.requester,
      requestedWarehouseId: input.requestedWarehouseId,
      validityDays: input.validityDays,
      status: input.status,
      items: input.items.map((it) => ({ ...it })),
      note: input.note,
      rejectReason: input.rejectReason,
      createdAt: NOW,
      updatedAt: NOW,
    });
    this.store.set(r.id, r);
    return r;
  }

  async update(request: MaterialRequest): Promise<void> {
    this.store.set(request.id, request);
  }

  async findById(id: number, companyId: number): Promise<MaterialRequest | null> {
    const r = this.store.get(id);
    return r && r.companyId === companyId ? r : null;
  }

  async listByCompany(
    companyId: number,
    options?: { status?: MaterialRequestStatus },
  ): Promise<ReadonlyArray<MaterialRequest>> {
    return [...this.store.values()].filter(
      (r) =>
        r.companyId === companyId && (options?.status === undefined || r.status === options.status),
    );
  }

  async nextSequence(companyId: number, year: number): Promise<number> {
    const prefix = `${year}-`;
    const count = [...this.store.values()].filter(
      (r) => r.companyId === companyId && r.date.startsWith(prefix),
    ).length;
    return count + 1;
  }
}

export class InMemoryInventoryCountRepository implements InventoryCountRepository {
  private seq = 0;
  private readonly store = new Map<number, InventoryCount>();

  async insert(input: NewInventoryCountInput): Promise<InventoryCount> {
    this.seq += 1;
    const c = InventoryCount.create({
      id: this.seq,
      companyId: input.companyId,
      no: input.no,
      date: input.date,
      warehouseId: input.warehouseId,
      period: input.period,
      status: input.status,
      items: input.items.map((it) => ({ ...it })),
      createdAt: NOW,
      updatedAt: NOW,
    });
    this.store.set(c.id, c);
    return c;
  }

  async update(count: InventoryCount): Promise<void> {
    this.store.set(count.id, count);
  }

  async findById(id: number, companyId: number): Promise<InventoryCount | null> {
    const c = this.store.get(id);
    return c && c.companyId === companyId ? c : null;
  }

  async listByCompany(
    companyId: number,
    options?: { status?: InventoryCountStatus; warehouseId?: number },
  ): Promise<ReadonlyArray<InventoryCount>> {
    return [...this.store.values()].filter(
      (c) =>
        c.companyId === companyId &&
        (options?.status === undefined || c.status === options.status) &&
        (options?.warehouseId === undefined || c.warehouseId === options.warehouseId),
    );
  }

  async nextSequence(companyId: number, year: number): Promise<number> {
    const prefix = `${year}-`;
    const count = [...this.store.values()].filter(
      (c) => c.companyId === companyId && c.date.startsWith(prefix),
    ).length;
    return count + 1;
  }
}

export class InMemoryAssignmentRepository implements AssignmentRepository {
  private seq = 0;
  private readonly store = new Map<number, Assignment>();

  async insert(input: NewAssignmentInput): Promise<Assignment> {
    this.seq += 1;
    const a = Assignment.create({
      id: this.seq,
      companyId: input.companyId,
      no: input.no,
      date: input.date,
      person: input.person,
      birim: input.birim,
      status: input.status,
      items: input.items.map((it) => ({ ...it })),
      note: input.note,
      createdAt: NOW,
      updatedAt: NOW,
    });
    this.store.set(a.id, a);
    return a;
  }

  async update(assignment: Assignment): Promise<void> {
    this.store.set(assignment.id, assignment);
  }

  async findById(id: number, companyId: number): Promise<Assignment | null> {
    const a = this.store.get(id);
    return a && a.companyId === companyId ? a : null;
  }

  async listByCompany(
    companyId: number,
    options?: { status?: AssignmentStatus },
  ): Promise<ReadonlyArray<Assignment>> {
    return [...this.store.values()].filter(
      (a) =>
        a.companyId === companyId && (options?.status === undefined || a.status === options.status),
    );
  }

  async nextSequence(companyId: number, year: number): Promise<number> {
    const prefix = `${year}-`;
    const count = [...this.store.values()].filter(
      (a) => a.companyId === companyId && a.date.startsWith(prefix),
    ).length;
    return count + 1;
  }
}
