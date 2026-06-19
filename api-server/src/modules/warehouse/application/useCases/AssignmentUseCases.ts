/**
 * Zimmet (Assignment) use-case'leri.
 *
 *   create — open zimmet oluşturur + her kalem için OUT stok hareketi
 *            (subType=zimmet, kalemin warehouseId'sinden); negatif stok kontrolü
 *            yapılır. no: ZMT-YYYY-NNNN.
 *   return — open → returned + her kalem için IN stok hareketi (subType=zimmet_iade,
 *            malzeme depoya geri girer).
 *   list/get — okuma.
 *
 * Hareket alan şekli RecordMovementUseCase ile aynı tutulur.
 */
import type { AssignmentItem } from '../../domain/entities/Assignment.js';
import type { Material } from '../../domain/entities/Material.js';
import { StockMovement } from '../../domain/entities/StockMovement.js';
import {
  AssignmentNotFoundError,
  EmptyItemsError,
  InsufficientStockError,
  InvalidWorkflowTransitionError,
  MaterialNotFoundError,
  WarehouseNotFoundError,
} from '../../domain/errors/WarehouseErrors.js';
import { StockLedger } from '../../domain/services/StockLedger.js';
import { formatAuxDocNo } from '../../domain/valueObjects/AuxDocKind.js';
import { MOVEMENT_NO_PREFIX } from '../../domain/valueObjects/MovementKind.js';
import { toAssignmentDto, type AssignmentDto } from '../dto/AuxDtos.js';
import type { AssignmentRepository, NewAssignmentInput } from '../ports/AssignmentRepository.js';
import type { Clock } from '../ports/Clock.js';
import type { MaterialRepository } from '../ports/MaterialRepository.js';
import type { StockMovementRepository } from '../ports/StockMovementRepository.js';
import type { WarehouseRepository } from '../ports/WarehouseRepository.js';

interface InputItem {
  materialId: number;
  warehouseId: number;
  qty: number;
}

export interface CreateAssignmentInput {
  companyId: number;
  date: string;
  person?: string | null;
  birim?: string | null;
  items: ReadonlyArray<InputItem>;
  note?: string | null;
  actorUserId?: number | null;
}

export class CreateAssignmentUseCase {
  constructor(
    private readonly assignments: AssignmentRepository,
    private readonly materials: MaterialRepository,
    private readonly movements: StockMovementRepository,
    private readonly warehouses: WarehouseRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateAssignmentInput): Promise<AssignmentDto> {
    if (input.items.length === 0) {
      throw new EmptyItemsError('Zimmet');
    }
    const now = this.clock.now();
    const year = parseYear(input.date) ?? now.getUTCFullYear();

    // Malzeme + depo doğrula, stok yeterliliği kontrol et (atomik niyet).
    const materialById = new Map<number, Material>();
    for (const it of input.items) {
      let material = materialById.get(it.materialId);
      if (material === undefined) {
        const found = await this.materials.findById(it.materialId, input.companyId);
        if (!found) {
          throw new MaterialNotFoundError(it.materialId);
        }
        material = found;
        materialById.set(it.materialId, found);
      }
      const wh = await this.warehouses.findById(it.warehouseId, input.companyId);
      if (!wh) {
        throw new WarehouseNotFoundError(it.warehouseId);
      }
      if (!material.allowsNegativeStock()) {
        const ledger = await this.movements.listByMaterial(input.companyId, it.materialId);
        const current = StockLedger.computeStockFor(ledger, it.materialId, it.warehouseId);
        if (current < it.qty) {
          throw new InsufficientStockError(
            it.materialId,
            it.warehouseId,
            String(round6(current)),
            String(round6(it.qty)),
          );
        }
      }
    }

    // Zimmet no üret + persist.
    const seq = await this.assignments.nextSequence(input.companyId, year);
    const no = formatAuxDocNo('assignment', year, seq);
    const toInsert: NewAssignmentInput = {
      companyId: input.companyId,
      no,
      date: input.date,
      person: input.person ?? null,
      birim: input.birim ?? null,
      status: 'open',
      items: normalizeItems(input.items),
      note: input.note ?? null,
    };
    const created = await this.assignments.insert(toInsert);

    // OUT hareketleri üret (subType=zimmet).
    for (const it of created.items) {
      const material = materialById.get(it.materialId)!;
      const mvSeq = await this.movements.nextSequence(input.companyId, 'out', year);
      const mvNo = `${MOVEMENT_NO_PREFIX.out}-${year}-${String(mvSeq).padStart(4, '0')}`;
      const movement = StockMovement.create({
        id: null,
        companyId: input.companyId,
        no: mvNo,
        kind: 'out',
        subType: 'zimmet',
        date: created.date,
        warehouseId: it.warehouseId,
        fromWarehouseId: null,
        toWarehouseId: null,
        materialId: it.materialId,
        qty: it.qty,
        unit: material.baseUnit,
        factor: 1,
        baseUnit: material.baseUnit,
        baseQty: it.qty,
        unitPrice: null,
        unitCostBase: null,
        total: null,
        lots: [],
        locationId: null,
        partyId: null,
        person: created.person,
        docNo: created.no,
        note: `Zimmet: ${created.person ?? ''}${created.birim ? ' / ' + created.birim : ''}`,
        createdBy: input.actorUserId ?? null,
        createdAt: now,
      });
      await this.movements.insert(movement);
    }

    return toAssignmentDto(created);
  }
}

export class ReturnAssignmentUseCase {
  constructor(
    private readonly assignments: AssignmentRepository,
    private readonly materials: MaterialRepository,
    private readonly movements: StockMovementRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    companyId: number;
    assignmentId: number;
    actorUserId?: number | null;
  }): Promise<AssignmentDto> {
    const existing = await this.assignments.findById(input.assignmentId, input.companyId);
    if (!existing) {
      throw new AssignmentNotFoundError(input.assignmentId);
    }
    if (existing.status !== 'open') {
      throw new InvalidWorkflowTransitionError('Zimmet', existing.status, 'iade');
    }

    const now = this.clock.now();
    const year = parseYear(existing.date) ?? now.getUTCFullYear();

    // Malzemeleri doğrula + cache.
    const materialById = new Map<number, Material>();
    for (const it of existing.items) {
      if (materialById.has(it.materialId)) continue;
      const material = await this.materials.findById(it.materialId, input.companyId);
      if (!material) {
        throw new MaterialNotFoundError(it.materialId);
      }
      materialById.set(it.materialId, material);
    }

    // IN hareketleri üret (subType=zimmet_iade).
    for (const it of existing.items) {
      const material = materialById.get(it.materialId)!;
      const seq = await this.movements.nextSequence(input.companyId, 'in', year);
      const no = `${MOVEMENT_NO_PREFIX.in}-${year}-${String(seq).padStart(4, '0')}`;
      const movement = StockMovement.create({
        id: null,
        companyId: input.companyId,
        no,
        kind: 'in',
        subType: 'zimmet_iade',
        date: toDateStr(now),
        warehouseId: it.warehouseId,
        fromWarehouseId: null,
        toWarehouseId: null,
        materialId: it.materialId,
        qty: it.qty,
        unit: material.baseUnit,
        factor: 1,
        baseUnit: material.baseUnit,
        baseQty: it.qty,
        unitPrice: null,
        unitCostBase: null,
        total: null,
        lots: [],
        locationId: null,
        partyId: null,
        person: existing.person,
        docNo: existing.no,
        note: `Zimmet iadesi: ${existing.no}`,
        createdBy: input.actorUserId ?? null,
        createdAt: now,
      });
      await this.movements.insert(movement);
    }

    const updated = existing.withUpdates({ status: 'returned' }, now);
    await this.assignments.update(updated);
    return toAssignmentDto(updated);
  }
}

export class ListAssignmentsUseCase {
  constructor(private readonly assignments: AssignmentRepository) {}

  async execute(input: {
    companyId: number;
    status?: AssignmentDto['status'];
  }): Promise<AssignmentDto[]> {
    const list = await this.assignments.listByCompany(input.companyId, {
      ...(input.status !== undefined ? { status: input.status } : {}),
    });
    return list.map(toAssignmentDto);
  }
}

export class GetAssignmentUseCase {
  constructor(private readonly assignments: AssignmentRepository) {}

  async execute(input: { companyId: number; assignmentId: number }): Promise<AssignmentDto> {
    const a = await this.assignments.findById(input.assignmentId, input.companyId);
    if (!a) {
      throw new AssignmentNotFoundError(input.assignmentId);
    }
    return toAssignmentDto(a);
  }
}

// --- yardımcılar ----------------------------------------------------------
function normalizeItems(items: ReadonlyArray<InputItem>): AssignmentItem[] {
  return items.map((it) => ({
    materialId: it.materialId,
    warehouseId: it.warehouseId,
    qty: it.qty,
  }));
}

function parseYear(date: string): number | null {
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(date);
  return match && match[1] !== undefined ? Number(match[1]) : null;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
