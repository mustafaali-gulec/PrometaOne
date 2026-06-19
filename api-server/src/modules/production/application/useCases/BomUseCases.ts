/**
 * BOM (reçete) use-case'leri.
 *
 * Create / Update / List / Get / Delete + Explode (çok seviyeli ihtiyaç ağacı)
 * + RollupCost (maliyet toplama). İş kuralı domain entity/servislerinde;
 * benzersizlik (no) hem use-case hem DB UNIQUE ile çift korumalı.
 */
import type { BomComponent, BomOperation } from '../../domain/entities/Bom.js';
import {
  BomNotFoundError,
  DuplicateBomNoError,
  WorkCenterNotFoundError,
} from '../../domain/errors/ProductionErrors.js';
import { BomExploder } from '../../domain/services/BomExploder.js';
import { CostRollup } from '../../domain/services/CostRollup.js';
import type { BomStatus } from '../../domain/valueObjects/BomStatus.js';
import { toBomDto, type BomCostDto, type BomDto, type ExplodeBomDto } from '../dto/BomDtos.js';
import type { BomRepository, NewBomInput } from '../ports/BomRepository.js';
import type { Clock } from '../ports/Clock.js';
import type { WorkCenterRepository } from '../ports/WorkCenterRepository.js';

export interface BomComponentInput {
  materialRef: string;
  qty: number;
  unit?: string | null;
  scrapPct?: number;
  isSemi?: boolean;
  sortOrder?: number;
}

export interface BomOperationInput {
  workCenterId?: number | null;
  name: string;
  setupMin?: number;
  runMinPerUnit?: number;
  seq?: number;
}

export interface CreateBomInput {
  companyId: number;
  no: string;
  productMaterialRef: string;
  name: string;
  outputQty?: number;
  outputUnit?: string | null;
  version?: string | null;
  status?: BomStatus;
  notes?: string | null;
  components?: BomComponentInput[];
  operations?: BomOperationInput[];
}

function normComponents(items: BomComponentInput[] | undefined): Omit<BomComponent, 'id'>[] {
  return (items ?? []).map((c, i) => ({
    materialRef: c.materialRef.trim(),
    qty: c.qty,
    unit: c.unit ?? null,
    scrapPct: c.scrapPct ?? 0,
    isSemi: c.isSemi ?? false,
    sortOrder: c.sortOrder ?? i,
  }));
}

function normOperations(items: BomOperationInput[] | undefined): Omit<BomOperation, 'id'>[] {
  return (items ?? []).map((o, i) => ({
    workCenterId: o.workCenterId ?? null,
    name: o.name.trim(),
    setupMin: o.setupMin ?? 0,
    runMinPerUnit: o.runMinPerUnit ?? 0,
    seq: o.seq ?? i,
  }));
}

/** Operasyonlarda atanan iş merkezlerinin bu şirkete ait olduğunu doğrula. */
async function assertWorkCentersExist(
  operations: { workCenterId: number | null }[],
  companyId: number,
  workCenters: WorkCenterRepository,
): Promise<void> {
  const ids = new Set<number>();
  for (const op of operations) {
    if (op.workCenterId != null) {
      ids.add(op.workCenterId);
    }
  }
  for (const id of ids) {
    const wc = await workCenters.findById(id, companyId);
    if (!wc) {
      throw new WorkCenterNotFoundError(id);
    }
  }
}

export class CreateBomUseCase {
  constructor(
    private readonly boms: BomRepository,
    private readonly workCenters: WorkCenterRepository,
  ) {}

  async execute(input: CreateBomInput): Promise<BomDto> {
    const no = input.no.trim();
    if (await this.boms.existsByNo(input.companyId, no)) {
      throw new DuplicateBomNoError(no);
    }
    const components = normComponents(input.components);
    const operations = normOperations(input.operations);
    await assertWorkCentersExist(operations, input.companyId, this.workCenters);

    const payload: NewBomInput = {
      companyId: input.companyId,
      no,
      productMaterialRef: input.productMaterialRef.trim(),
      name: input.name.trim(),
      outputQty: input.outputQty ?? 1,
      outputUnit: input.outputUnit ?? null,
      version: input.version ?? null,
      status: input.status ?? 'draft',
      notes: input.notes ?? null,
      components,
      operations,
    };
    const created = await this.boms.insert(payload);
    return toBomDto(created);
  }
}

export interface UpdateBomInput {
  companyId: number;
  bomId: number;
  no?: string;
  productMaterialRef?: string;
  name?: string;
  outputQty?: number;
  outputUnit?: string | null;
  version?: string | null;
  status?: BomStatus;
  notes?: string | null;
  components?: BomComponentInput[];
  operations?: BomOperationInput[];
}

export class UpdateBomUseCase {
  constructor(
    private readonly boms: BomRepository,
    private readonly workCenters: WorkCenterRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateBomInput): Promise<BomDto> {
    const existing = await this.boms.findById(input.bomId, input.companyId);
    if (!existing) {
      throw new BomNotFoundError(input.bomId);
    }
    if (input.no !== undefined) {
      const no = input.no.trim();
      if (await this.boms.existsByNo(input.companyId, no, input.bomId)) {
        throw new DuplicateBomNoError(no);
      }
    }

    const operations =
      input.operations !== undefined ? normOperations(input.operations) : undefined;
    if (operations) {
      await assertWorkCentersExist(operations, input.companyId, this.workCenters);
    }
    const components =
      input.components !== undefined ? normComponents(input.components) : undefined;

    const updated = existing.update(
      {
        ...(input.no !== undefined ? { no: input.no } : {}),
        ...(input.productMaterialRef !== undefined
          ? { productMaterialRef: input.productMaterialRef }
          : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.outputQty !== undefined ? { outputQty: input.outputQty } : {}),
        ...(input.outputUnit !== undefined ? { outputUnit: input.outputUnit } : {}),
        ...(input.version !== undefined ? { version: input.version } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(components !== undefined ? { components } : {}),
        ...(operations !== undefined ? { operations } : {}),
      },
      this.clock.now(),
    );
    await this.boms.update(updated);
    return toBomDto(updated);
  }
}

export interface ListBomsInput {
  companyId: number;
  status?: BomStatus;
  search?: string;
}

export class ListBomsUseCase {
  constructor(private readonly boms: BomRepository) {}

  async execute(input: ListBomsInput): Promise<BomDto[]> {
    const list = await this.boms.listByCompany(input.companyId, {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.search !== undefined ? { search: input.search } : {}),
    });
    return list.map(toBomDto);
  }
}

export interface GetBomInput {
  companyId: number;
  bomId: number;
}

export class GetBomUseCase {
  constructor(private readonly boms: BomRepository) {}

  async execute(input: GetBomInput): Promise<BomDto> {
    const bom = await this.boms.findById(input.bomId, input.companyId);
    if (!bom) {
      throw new BomNotFoundError(input.bomId);
    }
    return toBomDto(bom);
  }
}

export interface DeleteBomInput {
  companyId: number;
  bomId: number;
}

export class DeleteBomUseCase {
  constructor(private readonly boms: BomRepository) {}

  async execute(input: DeleteBomInput): Promise<{ ok: true }> {
    const bom = await this.boms.findById(input.bomId, input.companyId);
    if (!bom) {
      throw new BomNotFoundError(input.bomId);
    }
    await this.boms.delete(input.bomId, input.companyId);
    return { ok: true };
  }
}

export interface ExplodeBomInput {
  companyId: number;
  bomId: number;
  qty: number;
}

export class ExplodeBomUseCase {
  private readonly exploder = new BomExploder();

  constructor(private readonly boms: BomRepository) {}

  async execute(input: ExplodeBomInput): Promise<ExplodeBomDto> {
    const root = await this.boms.findById(input.bomId, input.companyId);
    if (!root) {
      throw new BomNotFoundError(input.bomId);
    }
    const all = await this.boms.listAllForExplosion(input.companyId);
    const byRef = new Map(all.map((b) => [b.productMaterialRef, b]));
    const result = this.exploder.explode(root, input.qty, byRef);
    return {
      bomId: root.id,
      productMaterialRef: root.productMaterialRef,
      qty: input.qty,
      requirements: result.requirements,
      rootOperations: result.rootOperations,
    };
  }
}

export interface RollupBomCostInput {
  companyId: number;
  bomId: number;
  /** materialRef → satın alma birim fiyatı (frontend WMS'ten gönderir). */
  materialPrices?: Record<string, number>;
  overheadPct?: number;
}

export class RollupBomCostUseCase {
  private readonly rollup = new CostRollup();

  constructor(
    private readonly boms: BomRepository,
    private readonly workCenters: WorkCenterRepository,
  ) {}

  async execute(input: RollupBomCostInput): Promise<BomCostDto> {
    const root = await this.boms.findById(input.bomId, input.companyId);
    if (!root) {
      throw new BomNotFoundError(input.bomId);
    }
    const all = await this.boms.listAllForExplosion(input.companyId);
    const semiBomMap = new Map(all.map((b) => [b.productMaterialRef, b]));

    const priceMap = new Map<string, number>(Object.entries(input.materialPrices ?? {}));

    const wcs = await this.workCenters.listByCompany(input.companyId, { includeArchived: true });
    const wcMap = new Map(wcs.map((w) => [w.id, { costPerHour: w.costPerHour }]));

    const result = this.rollup.rollupCost(
      root,
      priceMap,
      wcMap,
      input.overheadPct ?? 0,
      semiBomMap,
    );
    return {
      bomId: root.id,
      productMaterialRef: root.productMaterialRef,
      outputQty: root.outputQty,
      ...result,
    };
  }
}
