/**
 * Malzeme Talep (MaterialRequest) use-case'leri.
 *
 *   create/update/list/get — CRUD (no: TLP-YYYY-NNNN)
 *   approve  — pending → approved
 *   reject   — pending/approved → rejected (rejectReason ile)
 *   fulfill  — approved (veya pending) → fulfilled:
 *                requestedWarehouseId'den her kalem için OUT stok hareketi
 *                (subType=kullanima_verme, baseQty=item.qty) yaratır; önce
 *                negatif stok kontrolü yapar (StockLedger).
 *
 * Hareket alan şekli RecordMovementUseCase ile aynı tutulur.
 */
import type { Material } from '../../domain/entities/Material.js';
import type { MaterialRequestItem } from '../../domain/entities/MaterialRequest.js';
import { StockMovement } from '../../domain/entities/StockMovement.js';
import {
  EmptyItemsError,
  InsufficientStockError,
  InvalidMovementError,
  InvalidWorkflowTransitionError,
  MaterialNotFoundError,
  MaterialRequestNotFoundError,
  WarehouseNotFoundError,
} from '../../domain/errors/WarehouseErrors.js';
import { StockLedger } from '../../domain/services/StockLedger.js';
import { formatAuxDocNo } from '../../domain/valueObjects/AuxDocKind.js';
import { MOVEMENT_NO_PREFIX } from '../../domain/valueObjects/MovementKind.js';
import { toMaterialRequestDto, type MaterialRequestDto } from '../dto/AuxDtos.js';
import type { Clock } from '../ports/Clock.js';
import type { MaterialRepository } from '../ports/MaterialRepository.js';
import type {
  MaterialRequestRepository,
  NewMaterialRequestInput,
} from '../ports/MaterialRequestRepository.js';
import type { StockMovementRepository } from '../ports/StockMovementRepository.js';
import type { WarehouseRepository } from '../ports/WarehouseRepository.js';

interface InputItem {
  materialId: number;
  qty: number;
  unit?: string | null;
}

export interface CreateMaterialRequestInput {
  companyId: number;
  date: string;
  requesterUnit?: string | null;
  requester?: string | null;
  requestedWarehouseId?: number | null;
  validityDays?: number | null;
  items: ReadonlyArray<InputItem>;
  note?: string | null;
}

export class CreateMaterialRequestUseCase {
  constructor(
    private readonly requests: MaterialRequestRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateMaterialRequestInput): Promise<MaterialRequestDto> {
    if (input.items.length === 0) {
      throw new EmptyItemsError('Malzeme talebi');
    }
    const year = parseYear(input.date) ?? this.clock.now().getUTCFullYear();
    const seq = await this.requests.nextSequence(input.companyId, year);
    const toInsert: NewMaterialRequestInput = {
      companyId: input.companyId,
      no: formatAuxDocNo('request', year, seq),
      date: input.date,
      requesterUnit: input.requesterUnit ?? null,
      requester: input.requester ?? null,
      requestedWarehouseId: input.requestedWarehouseId ?? null,
      validityDays: input.validityDays ?? null,
      status: 'pending',
      items: normalizeItems(input.items),
      note: input.note ?? null,
      rejectReason: null,
    };
    const created = await this.requests.insert(toInsert);
    return toMaterialRequestDto(created);
  }
}

export interface UpdateMaterialRequestInput {
  companyId: number;
  requestId: number;
  date?: string;
  requesterUnit?: string | null;
  requester?: string | null;
  requestedWarehouseId?: number | null;
  validityDays?: number | null;
  items?: ReadonlyArray<InputItem>;
  note?: string | null;
}

export class UpdateMaterialRequestUseCase {
  constructor(
    private readonly requests: MaterialRequestRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateMaterialRequestInput): Promise<MaterialRequestDto> {
    const existing = await this.requests.findById(input.requestId, input.companyId);
    if (!existing) {
      throw new MaterialRequestNotFoundError(input.requestId);
    }
    if (existing.status === 'fulfilled' || existing.status === 'rejected') {
      throw new InvalidWorkflowTransitionError('Talep', existing.status, 'düzenleme');
    }
    if (input.items !== undefined && input.items.length === 0) {
      throw new EmptyItemsError('Malzeme talebi');
    }
    const updated = existing.withUpdates(
      {
        ...(input.date !== undefined ? { date: input.date } : {}),
        ...(input.requesterUnit !== undefined ? { requesterUnit: input.requesterUnit } : {}),
        ...(input.requester !== undefined ? { requester: input.requester } : {}),
        ...(input.requestedWarehouseId !== undefined
          ? { requestedWarehouseId: input.requestedWarehouseId }
          : {}),
        ...(input.validityDays !== undefined ? { validityDays: input.validityDays } : {}),
        ...(input.items !== undefined ? { items: normalizeItems(input.items) } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
      this.clock.now(),
    );
    await this.requests.update(updated);
    return toMaterialRequestDto(updated);
  }
}

export class ApproveMaterialRequestUseCase {
  constructor(
    private readonly requests: MaterialRequestRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: { companyId: number; requestId: number }): Promise<MaterialRequestDto> {
    const existing = await this.requests.findById(input.requestId, input.companyId);
    if (!existing) {
      throw new MaterialRequestNotFoundError(input.requestId);
    }
    if (existing.status !== 'pending') {
      throw new InvalidWorkflowTransitionError('Talep', existing.status, 'onay');
    }
    const updated = existing.withUpdates({ status: 'approved' }, this.clock.now());
    await this.requests.update(updated);
    return toMaterialRequestDto(updated);
  }
}

export class RejectMaterialRequestUseCase {
  constructor(
    private readonly requests: MaterialRequestRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    companyId: number;
    requestId: number;
    reason: string;
  }): Promise<MaterialRequestDto> {
    const existing = await this.requests.findById(input.requestId, input.companyId);
    if (!existing) {
      throw new MaterialRequestNotFoundError(input.requestId);
    }
    if (existing.status !== 'pending' && existing.status !== 'approved') {
      throw new InvalidWorkflowTransitionError('Talep', existing.status, 'red');
    }
    const updated = existing.withUpdates(
      { status: 'rejected', rejectReason: input.reason },
      this.clock.now(),
    );
    await this.requests.update(updated);
    return toMaterialRequestDto(updated);
  }
}

/**
 * Talebi karşılar: requestedWarehouseId'den her kalem için OUT hareketi yaratır
 * (subType=kullanima_verme), sonra status=fulfilled yapar. Negatif stok
 * kontrolü her kalem için yapılır (negativeControl='block' malzemelerde).
 */
export class FulfillMaterialRequestUseCase {
  constructor(
    private readonly requests: MaterialRequestRepository,
    private readonly materials: MaterialRepository,
    private readonly movements: StockMovementRepository,
    private readonly warehouses: WarehouseRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    companyId: number;
    requestId: number;
    actorUserId?: number | null;
  }): Promise<MaterialRequestDto> {
    const existing = await this.requests.findById(input.requestId, input.companyId);
    if (!existing) {
      throw new MaterialRequestNotFoundError(input.requestId);
    }
    if (existing.status !== 'pending' && existing.status !== 'approved') {
      throw new InvalidWorkflowTransitionError('Talep', existing.status, 'karşılama');
    }
    const warehouseId = existing.requestedWarehouseId;
    if (warehouseId === null) {
      throw new InvalidMovementError(
        'talepte karşılanacak depo (requestedWarehouseId) seçili değil',
      );
    }
    if (existing.items.length === 0) {
      throw new EmptyItemsError('Malzeme talebi');
    }

    const now = this.clock.now();
    const year = parseYear(existing.date) ?? now.getUTCFullYear();

    // Depo doğrulaması.
    const wh = await this.warehouses.findById(warehouseId, input.companyId);
    if (!wh) {
      throw new WarehouseNotFoundError(warehouseId);
    }

    // Önce tüm kalemler için malzeme + stok yeterliliği doğrula (atomik niyet);
    // malzemeleri cache'le (OUT üretiminde tekrar sorgulamamak için).
    const materialById = new Map<number, Material>();
    for (const it of existing.items) {
      const material = await this.materials.findById(it.materialId, input.companyId);
      if (!material) {
        throw new MaterialNotFoundError(it.materialId);
      }
      materialById.set(it.materialId, material);
      if (!material.allowsNegativeStock()) {
        const ledger = await this.movements.listByMaterial(input.companyId, it.materialId);
        const current = StockLedger.computeStockFor(ledger, it.materialId, warehouseId);
        if (current < it.qty) {
          throw new InsufficientStockError(
            it.materialId,
            warehouseId,
            String(round6(current)),
            String(round6(it.qty)),
          );
        }
      }
    }

    // OUT hareketleri üret.
    for (const it of existing.items) {
      const material = materialById.get(it.materialId)!;
      const unit = it.unit ?? material.baseUnit;
      const factor = material.resolveFactor(unit) ?? 1;
      const baseQty = round6(it.qty * factor);
      const seq = await this.movements.nextSequence(input.companyId, 'out', year);
      const no = `${MOVEMENT_NO_PREFIX.out}-${year}-${String(seq).padStart(4, '0')}`;
      const movement = StockMovement.create({
        id: null,
        companyId: input.companyId,
        no,
        kind: 'out',
        subType: 'kullanima_verme',
        date: existing.date,
        warehouseId,
        fromWarehouseId: null,
        toWarehouseId: null,
        materialId: it.materialId,
        qty: it.qty,
        unit,
        factor,
        baseUnit: material.baseUnit,
        baseQty,
        unitPrice: null,
        unitCostBase: null,
        total: null,
        lots: [],
        locationId: null,
        partyId: null,
        person: null,
        docNo: existing.no,
        note: `Talep karşılama: ${existing.no}`,
        createdBy: input.actorUserId ?? null,
        createdAt: now,
      });
      await this.movements.insert(movement);
    }

    const updated = existing.withUpdates({ status: 'fulfilled' }, now);
    await this.requests.update(updated);
    return toMaterialRequestDto(updated);
  }
}

export class ListMaterialRequestsUseCase {
  constructor(private readonly requests: MaterialRequestRepository) {}

  async execute(input: {
    companyId: number;
    status?: MaterialRequestDto['status'];
  }): Promise<MaterialRequestDto[]> {
    const list = await this.requests.listByCompany(input.companyId, {
      ...(input.status !== undefined ? { status: input.status } : {}),
    });
    return list.map(toMaterialRequestDto);
  }
}

export class GetMaterialRequestUseCase {
  constructor(private readonly requests: MaterialRequestRepository) {}

  async execute(input: { companyId: number; requestId: number }): Promise<MaterialRequestDto> {
    const r = await this.requests.findById(input.requestId, input.companyId);
    if (!r) {
      throw new MaterialRequestNotFoundError(input.requestId);
    }
    return toMaterialRequestDto(r);
  }
}

// --- yardımcılar ----------------------------------------------------------
function normalizeItems(items: ReadonlyArray<InputItem>): MaterialRequestItem[] {
  return items.map((it) => ({
    materialId: it.materialId,
    qty: it.qty,
    unit: it.unit ?? null,
  }));
}

function parseYear(date: string): number | null {
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(date);
  return match && match[1] !== undefined ? Number(match[1]) : null;
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
