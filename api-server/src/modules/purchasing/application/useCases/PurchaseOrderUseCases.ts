/**
 * Satınalma siparişi (PO) use-case'leri.
 *
 * CreatePurchaseOrder otomatik PO numarası üretir (PO-YYYY-NNNN), tedarikçinin
 * (vendorId) varlığını doğrular (cari ilişkisi zorunlu). prId verilip lines boş
 * gelirse PR kalemlerinden satırlar kopyalanır. ChangePoStatus statü geçiş
 * kurallarını (PoStatus) uygular.
 */
import type { PurchaseOrderLine } from '../../domain/entities/PurchaseOrder.js';
import {
  PurchaseOrderNotFoundError,
  PurchaseRequestNotFoundError,
  VendorNotFoundError,
} from '../../domain/errors/PurchasingErrors.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';
import type { PoStatus } from '../../domain/valueObjects/PoStatus.js';
import { toPurchaseOrderDto, type PurchaseOrderDto } from '../dto/PurchaseOrderDtos.js';
import type { Clock } from '../ports/Clock.js';
import type {
  ListPurchaseOrdersOptions,
  PurchaseOrderRepository,
} from '../ports/PurchaseOrderRepository.js';
import type { PurchaseRequestRepository } from '../ports/PurchaseRequestRepository.js';
import type { VendorRepository } from '../ports/VendorRepository.js';

export interface PoLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  receivedQty?: number | undefined;
}

function toLines(lines: ReadonlyArray<PoLineInput>): PurchaseOrderLine[] {
  return lines.map((l, idx) => ({
    lineNo: idx + 1,
    description: l.description.trim(),
    quantity: Number(l.quantity) || 0,
    receivedQty: Number(l.receivedQty) || 0,
    unitPrice: Number(l.unitPrice) || 0,
  }));
}

export interface CreatePurchaseOrderInput {
  companyId: number;
  vendorId: number;
  prId?: number | null | undefined;
  currency?: CurrencyCode | undefined;
  note?: string | null | undefined;
  createdBy?: number | null | undefined;
  lines?: PoLineInput[] | undefined;
  /** true → doğrudan sipariş ver (ordered) */
  markOrdered?: boolean | undefined;
}

export class CreatePurchaseOrderUseCase {
  constructor(
    private readonly pos: PurchaseOrderRepository,
    private readonly vendors: VendorRepository,
    private readonly prs: PurchaseRequestRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreatePurchaseOrderInput): Promise<PurchaseOrderDto> {
    const vendor = await this.vendors.findById(input.vendorId, input.companyId);
    if (!vendor) throw new VendorNotFoundError(input.vendorId);

    // Satırlar verilmediyse ve bir PR'a bağlıysa, PR kalemlerinden kopyala
    let lines: PoLineInput[] = input.lines ?? [];
    if (lines.length === 0 && input.prId) {
      const pr = await this.prs.findById(input.prId, input.companyId);
      if (!pr) throw new PurchaseRequestNotFoundError(input.prId);
      lines = pr.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      }));
    }

    const now = this.clock.now();
    const year = now.getFullYear();
    const prefix = `PO-${year}-`;
    const seq = (await this.pos.countByNoPrefix(input.companyId, prefix)) + 1;
    const poNo = `${prefix}${String(seq).padStart(4, '0')}`;

    const created = await this.pos.insert({
      companyId: input.companyId,
      poNo,
      vendorId: input.vendorId,
      prId: input.prId ?? null,
      status: input.markOrdered ? 'ordered' : 'draft',
      currency: input.currency ?? 'TRY',
      note: input.note?.trim() || null,
      orderedAt: input.markOrdered ? now : null,
      createdBy: input.createdBy ?? null,
      lines: toLines(lines),
    });
    return toPurchaseOrderDto(created);
  }
}

export interface ListPurchaseOrdersInput {
  companyId: number;
  status?: PoStatus;
  vendorId?: number;
}

export class ListPurchaseOrdersUseCase {
  constructor(private readonly pos: PurchaseOrderRepository) {}

  async execute(input: ListPurchaseOrdersInput): Promise<PurchaseOrderDto[]> {
    const options: ListPurchaseOrdersOptions = {};
    if (input.status !== undefined) options.status = input.status;
    if (input.vendorId !== undefined) options.vendorId = input.vendorId;
    const list = await this.pos.listByCompany(input.companyId, options);
    return list.map(toPurchaseOrderDto);
  }
}

export interface ChangePoStatusInput {
  companyId: number;
  poId: number;
  status: PoStatus;
}

export class ChangePoStatusUseCase {
  constructor(
    private readonly pos: PurchaseOrderRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: ChangePoStatusInput): Promise<PurchaseOrderDto> {
    const po = await this.pos.findById(input.poId, input.companyId);
    if (!po) throw new PurchaseOrderNotFoundError(input.poId);
    const updated = po.changeStatus(input.status, this.clock.now());
    await this.pos.update(updated);
    return toPurchaseOrderDto(updated);
  }
}
