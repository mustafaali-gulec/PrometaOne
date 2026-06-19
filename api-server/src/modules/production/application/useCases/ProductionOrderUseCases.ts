/**
 * ProductionOrder (üretim emri) use-case'leri.
 *
 * Create (reçeteden patlatarak malzeme rezervasyonu + operasyon üretir) /
 * List / Get / UpdateStatus (durum makinesi VO ile) / Complete.
 */
import type {
  CostSnapshot,
  ProductionOrderMaterial,
  ProductionOrderOperation,
  ProductionOrderPriority,
} from '../../domain/entities/ProductionOrder.js';
import {
  BomNotFoundError,
  DuplicateProductionOrderNoError,
  InvalidProductionOrderError,
  ProductionOrderNotFoundError,
} from '../../domain/errors/ProductionErrors.js';
import { BomExploder } from '../../domain/services/BomExploder.js';
import type { ProductionOrderStatusValue } from '../../domain/valueObjects/ProductionOrderStatus.js';
import { toProductionOrderDto, type ProductionOrderDto } from '../dto/ProductionOrderDtos.js';
import type { BomRepository } from '../ports/BomRepository.js';
import type { Clock } from '../ports/Clock.js';
import type {
  NewProductionOrderInput,
  ProductionOrderRepository,
} from '../ports/ProductionOrderRepository.js';

export interface CreateProductionOrderInput {
  companyId: number;
  no: string;
  /** Reçeteden patlatma için bomId; verilirse malzeme/operasyon otomatik üretilir. */
  bomId?: number | null;
  /** bomId yoksa zorunlu (reçetesiz manuel emir). */
  productMaterialRef?: string;
  qty: number;
  unit?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  warehouseRef?: string | null;
  priority?: ProductionOrderPriority;
  source?: 'manual' | 'mrp';
}

export class CreateProductionOrderUseCase {
  private readonly exploder = new BomExploder();

  constructor(
    private readonly orders: ProductionOrderRepository,
    private readonly boms: BomRepository,
  ) {}

  async execute(input: CreateProductionOrderInput): Promise<ProductionOrderDto> {
    const no = input.no.trim();
    if (await this.orders.existsByNo(input.companyId, no)) {
      throw new DuplicateProductionOrderNoError(no);
    }
    if (!(input.qty > 0)) {
      throw new InvalidProductionOrderError('miktar pozitif olmalı');
    }

    let productMaterialRef = input.productMaterialRef?.trim() ?? '';
    let unit = input.unit ?? null;
    let materials: Omit<ProductionOrderMaterial, 'id'>[] = [];
    let operations: Omit<ProductionOrderOperation, 'id'>[] = [];
    const bomId = input.bomId ?? null;

    if (bomId != null) {
      const root = await this.boms.findById(bomId, input.companyId);
      if (!root) {
        throw new BomNotFoundError(bomId);
      }
      productMaterialRef = root.productMaterialRef;
      unit = unit ?? root.outputUnit;

      const all = await this.boms.listAllForExplosion(input.companyId);
      const byRef = new Map(all.map((b) => [b.productMaterialRef, b]));
      const exploded = this.exploder.explode(root, input.qty, byRef);

      materials = exploded.requirements.map((r) => ({
        materialRef: r.materialRef,
        requiredQty: r.qty,
        unit: r.unit,
        consumedQty: 0,
      }));
      operations = exploded.rootOperations.map((op) => ({
        workCenterId: op.workCenterId,
        name: op.name,
        plannedMin: op.plannedMin,
        status: 'pending' as const,
        seq: op.seq,
      }));
    }

    if (productMaterialRef.length === 0) {
      throw new InvalidProductionOrderError(
        'reçetesiz emirde mamul referansı (productMaterialRef) zorunlu',
      );
    }

    const payload: NewProductionOrderInput = {
      companyId: input.companyId,
      no,
      bomId,
      productMaterialRef,
      qty: input.qty,
      unit,
      status: 'planned',
      plannedStart: input.plannedStart ?? null,
      plannedEnd: input.plannedEnd ?? null,
      warehouseRef: input.warehouseRef ?? null,
      priority: input.priority ?? 'normal',
      source: input.source ?? 'manual',
      producedQty: 0,
      scrapQty: 0,
      costSnapshot: null,
      consumed: false,
      materials,
      operations,
    };
    const created = await this.orders.insert(payload);
    return toProductionOrderDto(created);
  }
}

export interface ListProductionOrdersInput {
  companyId: number;
  status?: ProductionOrderStatusValue;
}

export class ListProductionOrdersUseCase {
  constructor(private readonly orders: ProductionOrderRepository) {}

  async execute(input: ListProductionOrdersInput): Promise<ProductionOrderDto[]> {
    const list = await this.orders.listByCompany(input.companyId, {
      ...(input.status !== undefined ? { status: input.status } : {}),
    });
    return list.map(toProductionOrderDto);
  }
}

export interface GetProductionOrderInput {
  companyId: number;
  orderId: number;
}

export class GetProductionOrderUseCase {
  constructor(private readonly orders: ProductionOrderRepository) {}

  async execute(input: GetProductionOrderInput): Promise<ProductionOrderDto> {
    const order = await this.orders.findById(input.orderId, input.companyId);
    if (!order) {
      throw new ProductionOrderNotFoundError(input.orderId);
    }
    return toProductionOrderDto(order);
  }
}

export interface UpdateProductionOrderStatusInput {
  companyId: number;
  orderId: number;
  status: ProductionOrderStatusValue;
}

export class UpdateProductionOrderStatusUseCase {
  constructor(
    private readonly orders: ProductionOrderRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateProductionOrderStatusInput): Promise<ProductionOrderDto> {
    const order = await this.orders.findById(input.orderId, input.companyId);
    if (!order) {
      throw new ProductionOrderNotFoundError(input.orderId);
    }
    // 'completed' geçişi CompleteProductionOrderUseCase üzerinden yapılmalı
    // (produced/scrap/cost zorunlu). Burada engelle.
    if (input.status === 'completed') {
      throw new InvalidProductionOrderError(
        'tamamlama için /complete uç noktasını kullanın (üretilen miktar zorunlu)',
      );
    }
    const updated = order.transitionTo(input.status, this.clock.now());
    await this.orders.update(updated);
    return toProductionOrderDto(updated);
  }
}

export interface CompleteProductionOrderInput {
  companyId: number;
  orderId: number;
  producedQty: number;
  scrapQty?: number;
  costSnapshot?: CostSnapshot | null;
}

export class CompleteProductionOrderUseCase {
  constructor(
    private readonly orders: ProductionOrderRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CompleteProductionOrderInput): Promise<ProductionOrderDto> {
    const order = await this.orders.findById(input.orderId, input.companyId);
    if (!order) {
      throw new ProductionOrderNotFoundError(input.orderId);
    }
    const completed = order.complete(
      {
        producedQty: input.producedQty,
        scrapQty: input.scrapQty ?? 0,
        costSnapshot: input.costSnapshot ?? null,
      },
      this.clock.now(),
    );
    await this.orders.update(completed);
    return toProductionOrderDto(completed);
  }
}
