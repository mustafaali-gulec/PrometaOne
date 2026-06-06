/**
 * Malzeme & Depo use-case'leri: malzeme master, depo, stok hareketi (+stok
 * görünümü), malzeme talebi (header+lines+durum). Stok hareketi malzeme/depo
 * varlığını ve tür-depo uyumunu doğrular; talep onayı görev ayrılığına tabidir.
 */
import { StockMovement } from '../../domain/entities/StockMovement.js';
import {
  ConstructionValidationError,
  DuplicateMaterialCodeError,
  DuplicateWarehouseCodeError,
  MaterialNotFoundError,
  MaterialRequestNotFoundError,
  ProjectNotFoundError,
  WarehouseNotFoundError,
} from '../../domain/errors/ConstructionErrors.js';
import { round2 } from '../../domain/valueObjects/Currency.js';
import type { MaterialRequestStatus, StockMoveKind } from '../../domain/valueObjects/Material.js';
import {
  toMaterialDto,
  toMaterialRequestDto,
  toMaterialRequestSummaryDto,
  toStockMovementDto,
  toWarehouseDto,
  type MaterialDto,
  type MaterialRequestDto,
  type MaterialRequestSummaryDto,
  type StockMovementDto,
  type WarehouseDto,
} from '../dto/MaterialDtos.js';
import type { Clock } from '../ports/Clock.js';
import type {
  MaterialRepository,
  MaterialRequestRepository,
  StockRepository,
  StockView,
  WarehouseRepository,
} from '../ports/MaterialRepositories.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';

// ===== MATERIALS ============================================================
export interface CreateMaterialInput {
  companyId: number;
  code: string;
  name: string;
  unit?: string | undefined;
  wastePct?: number | undefined;
  createdBy?: number | null | undefined;
}
export class CreateMaterialUseCase {
  constructor(private readonly materials: MaterialRepository) {}
  async execute(input: CreateMaterialInput): Promise<MaterialDto> {
    const code = input.code.trim();
    if (await this.materials.existsByCode(input.companyId, code)) {
      throw new DuplicateMaterialCodeError(code);
    }
    const created = await this.materials.insert({
      companyId: input.companyId,
      code,
      name: input.name.trim(),
      unit: input.unit?.trim() || 'ad',
      wastePct: input.wastePct ?? 0,
      createdBy: input.createdBy ?? null,
    });
    return toMaterialDto(created);
  }
}
export class ListMaterialsUseCase {
  constructor(private readonly materials: MaterialRepository) {}
  async execute(input: { companyId: number; includeInactive?: boolean }): Promise<MaterialDto[]> {
    const list = await this.materials.listByCompany(input.companyId, input.includeInactive);
    return list.map(toMaterialDto);
  }
}
export interface UpdateMaterialInput {
  companyId: number;
  materialId: number;
  name?: string | undefined;
  unit?: string | undefined;
  wastePct?: number | undefined;
}
export class UpdateMaterialUseCase {
  constructor(
    private readonly materials: MaterialRepository,
    private readonly clock: Clock,
  ) {}
  async execute(input: UpdateMaterialInput): Promise<MaterialDto> {
    const m = await this.materials.findById(input.materialId, input.companyId);
    if (!m) throw new MaterialNotFoundError(input.materialId);
    const updated = m.update(
      {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.wastePct !== undefined ? { wastePct: input.wastePct } : {}),
      },
      this.clock.now(),
    );
    await this.materials.update(updated);
    return toMaterialDto(updated);
  }
}
export class DeactivateMaterialUseCase {
  constructor(
    private readonly materials: MaterialRepository,
    private readonly clock: Clock,
  ) {}
  async execute(input: { companyId: number; materialId: number }): Promise<MaterialDto> {
    const m = await this.materials.findById(input.materialId, input.companyId);
    if (!m) throw new MaterialNotFoundError(input.materialId);
    const d = m.deactivate(this.clock.now());
    await this.materials.update(d);
    return toMaterialDto(d);
  }
}

// ===== WAREHOUSES ===========================================================
export interface CreateWarehouseInput {
  companyId: number;
  projectId: number;
  code: string;
  name: string;
}
export class CreateWarehouseUseCase {
  constructor(
    private readonly warehouses: WarehouseRepository,
    private readonly projects: ProjectRepository,
  ) {}
  async execute(input: CreateWarehouseInput): Promise<WarehouseDto> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);
    const code = input.code.trim();
    if (await this.warehouses.existsByCode(input.companyId, code)) {
      throw new DuplicateWarehouseCodeError(code);
    }
    const created = await this.warehouses.insert({
      companyId: input.companyId,
      projectId: input.projectId,
      code,
      name: input.name.trim(),
    });
    return toWarehouseDto(created);
  }
}
export class ListWarehousesUseCase {
  constructor(private readonly warehouses: WarehouseRepository) {}
  async execute(input: { companyId: number; projectId: number }): Promise<WarehouseDto[]> {
    const list = await this.warehouses.listByProject(input.projectId, input.companyId);
    return list.map(toWarehouseDto);
  }
}

// ===== STOCK ================================================================
export interface RecordMovementInput {
  companyId: number;
  materialId: number;
  kind: StockMoveKind;
  fromWarehouse?: number | null | undefined;
  toWarehouse?: number | null | undefined;
  qty: number;
  unitCost?: number | undefined;
  boqLineId?: number | null | undefined;
  description?: string | null | undefined;
  movedAt: string;
  createdBy?: number | null | undefined;
}
export class RecordStockMovementUseCase {
  constructor(
    private readonly stock: StockRepository,
    private readonly materials: MaterialRepository,
    private readonly warehouses: WarehouseRepository,
  ) {}
  async execute(input: RecordMovementInput): Promise<StockMovementDto> {
    const material = await this.materials.findById(input.materialId, input.companyId);
    if (!material) throw new MaterialNotFoundError(input.materialId);
    const from = input.fromWarehouse ?? null;
    const to = input.toWarehouse ?? null;
    // Tür-depo uyumu (entity ile aynı kural) — domain hatasına sar (HTTP 400)
    try {
      StockMovement.assertWarehouses(input.kind, from, to);
    } catch (e) {
      throw new ConstructionValidationError(
        e instanceof Error ? e.message : 'Geçersiz depo seçimi',
      );
    }
    for (const w of [from, to]) {
      if (w !== null && !(await this.warehouses.findById(w, input.companyId))) {
        throw new WarehouseNotFoundError(w);
      }
    }
    const created = await this.stock.recordMovement({
      companyId: input.companyId,
      materialId: input.materialId,
      kind: input.kind,
      fromWarehouse: from,
      toWarehouse: to,
      qty: input.qty,
      unitCost: round2(input.unitCost ?? 0),
      boqLineId: input.boqLineId ?? null,
      description: input.description?.trim() || null,
      movedAt: input.movedAt,
      createdBy: input.createdBy ?? null,
    });
    return toStockMovementDto(created);
  }
}
export class ListStockUseCase {
  constructor(private readonly stock: StockRepository) {}
  async execute(input: {
    companyId: number;
    projectId: number;
  }): Promise<ReadonlyArray<StockView>> {
    return this.stock.listStockByProject(input.projectId, input.companyId);
  }
}
export class ListMovementsUseCase {
  constructor(private readonly stock: StockRepository) {}
  async execute(input: { companyId: number; projectId: number }): Promise<StockMovementDto[]> {
    const list = await this.stock.listMovementsByProject(input.projectId, input.companyId);
    return list.map(toStockMovementDto);
  }
}

// ===== MATERIAL REQUESTS ====================================================
export interface CreateMaterialRequestInput {
  companyId: number;
  projectId: number;
  neededBy?: string | null | undefined;
  note?: string | null | undefined;
  requestedBy?: number | null | undefined;
  lines: ReadonlyArray<{ materialId: number; qty: number; note?: string | null | undefined }>;
}
export class CreateMaterialRequestUseCase {
  constructor(
    private readonly requests: MaterialRequestRepository,
    private readonly projects: ProjectRepository,
    private readonly clock: Clock,
  ) {}
  async execute(input: CreateMaterialRequestInput): Promise<MaterialRequestDto> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);
    if (input.lines.length === 0) {
      throw new ConstructionValidationError('Talep en az bir kalem içermeli');
    }
    const seq = (await this.requests.countByProject(input.projectId, input.companyId)) + 1;
    const year = this.clock.now().getFullYear();
    const reqNo = `MT-${String(year)}-${String(seq).padStart(4, '0')}`;
    const created = await this.requests.insert({
      companyId: input.companyId,
      projectId: input.projectId,
      reqNo,
      neededBy: input.neededBy ?? null,
      note: input.note?.trim() || null,
      requestedBy: input.requestedBy ?? null,
      lines: input.lines.map((l) => ({
        materialId: l.materialId,
        qty: l.qty,
        note: l.note ?? null,
      })),
    });
    return toMaterialRequestDto(created);
  }
}
export class GetMaterialRequestUseCase {
  constructor(private readonly requests: MaterialRequestRepository) {}
  async execute(input: { companyId: number; requestId: number }): Promise<MaterialRequestDto> {
    const r = await this.requests.findById(input.requestId, input.companyId);
    if (!r) throw new MaterialRequestNotFoundError(input.requestId);
    return toMaterialRequestDto(r);
  }
}
export class ListMaterialRequestsUseCase {
  constructor(private readonly requests: MaterialRequestRepository) {}
  async execute(input: {
    companyId: number;
    projectId: number;
  }): Promise<MaterialRequestSummaryDto[]> {
    const list = await this.requests.listByProject(input.projectId, input.companyId);
    return list.map(toMaterialRequestSummaryDto);
  }
}
export interface SaveMaterialRequestLinesInput {
  companyId: number;
  requestId: number;
  lines: ReadonlyArray<{ materialId: number; qty: number; note?: string | null | undefined }>;
}
export class SaveMaterialRequestLinesUseCase {
  constructor(private readonly requests: MaterialRequestRepository) {}
  async execute(input: SaveMaterialRequestLinesInput): Promise<MaterialRequestDto> {
    const r = await this.requests.findById(input.requestId, input.companyId);
    if (!r) throw new MaterialRequestNotFoundError(input.requestId);
    r.assertEditable();
    const saved = await this.requests.replaceLines(
      input.requestId,
      input.companyId,
      input.lines.map((l) => ({ materialId: l.materialId, qty: l.qty, note: l.note ?? null })),
    );
    return toMaterialRequestDto(saved);
  }
}
export interface ChangeMaterialRequestStatusInput {
  companyId: number;
  requestId: number;
  status: MaterialRequestStatus;
  actorUserId?: number | null | undefined;
}
export class ChangeMaterialRequestStatusUseCase {
  constructor(
    private readonly requests: MaterialRequestRepository,
    private readonly clock: Clock,
  ) {}
  async execute(input: ChangeMaterialRequestStatusInput): Promise<MaterialRequestDto> {
    const r = await this.requests.findById(input.requestId, input.companyId);
    if (!r) throw new MaterialRequestNotFoundError(input.requestId);
    const actorUserId = input.actorUserId ?? null;
    const updated = r.changeStatus(input.status, this.clock.now(), actorUserId);
    const saved = await this.requests.changeStatus(input.requestId, input.companyId, {
      toStatus: updated.status,
      approvedBy: updated.toJSON().approvedBy,
    });
    return toMaterialRequestDto(saved);
  }
}
