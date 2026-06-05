/**
 * Purchasing use-case testleri için in-memory fake repository'ler.
 * Production Pg* repository'lerin sözleşmesini taklit eder.
 */
import type { Clock } from '../application/ports/Clock.js';
import type {
  ListPurchaseOrdersOptions,
  NewPurchaseOrderInput,
  PurchaseOrderRepository,
} from '../application/ports/PurchaseOrderRepository.js';
import type {
  ListPurchaseRequestsOptions,
  NewPurchaseRequestInput,
  PurchaseRequestRepository,
} from '../application/ports/PurchaseRequestRepository.js';
import type {
  ListVendorsOptions,
  NewVendorInput,
  VendorRepository,
} from '../application/ports/VendorRepository.js';
import { PurchaseOrder } from '../domain/entities/PurchaseOrder.js';
import { PurchaseRequest } from '../domain/entities/PurchaseRequest.js';
import { Vendor } from '../domain/entities/Vendor.js';

const FIXED = new Date('2026-06-05T00:00:00.000Z');

export class FixedClock implements Clock {
  constructor(private readonly fixed: Date = FIXED) {}
  now(): Date {
    return this.fixed;
  }
}

export class InMemoryVendorRepository implements VendorRepository {
  private seq = 0;
  private readonly store = new Map<number, Vendor>();

  async insert(input: NewVendorInput): Promise<Vendor> {
    this.seq += 1;
    const v = Vendor.create({
      id: this.seq,
      companyId: input.companyId,
      code: input.code,
      name: input.name,
      taxId: input.taxId,
      taxOffice: input.taxOffice,
      address: input.address,
      personType: input.personType,
      cariClass: input.cariClass,
      accountCode: input.accountCode,
      active: true,
      createdBy: input.createdBy,
      createdAt: FIXED,
      updatedAt: FIXED,
    });
    this.store.set(v.id, v);
    return v;
  }

  async update(vendor: Vendor): Promise<void> {
    this.store.set(vendor.id, vendor);
  }

  async findById(id: number, companyId: number): Promise<Vendor | null> {
    const v = this.store.get(id);
    return v && v.companyId === companyId ? v : null;
  }

  async listByCompany(
    companyId: number,
    options?: ListVendorsOptions,
  ): Promise<ReadonlyArray<Vendor>> {
    let list = [...this.store.values()].filter((v) => v.companyId === companyId);
    if (options?.includeInactive !== true) list = list.filter((v) => v.active);
    if (options?.search) {
      const q = options.search.toLowerCase();
      list = list.filter(
        (v) => v.name.toLowerCase().includes(q) || v.code.toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  async existsByCode(companyId: number, code: string, excludeId?: number): Promise<boolean> {
    return [...this.store.values()].some(
      (v) => v.companyId === companyId && v.code === code && v.id !== excludeId,
    );
  }
}

export class InMemoryPurchaseRequestRepository implements PurchaseRequestRepository {
  private seq = 0;
  private readonly store = new Map<number, PurchaseRequest>();

  async insert(input: NewPurchaseRequestInput): Promise<PurchaseRequest> {
    this.seq += 1;
    const pr = PurchaseRequest.create({
      id: this.seq,
      companyId: input.companyId,
      prNo: input.prNo,
      requesterUserId: input.requesterUserId,
      departmentId: input.departmentId,
      category: input.category,
      priority: input.priority,
      status: input.status,
      currency: input.currency,
      justification: input.justification,
      requiredBy: input.requiredBy,
      requestedAt: FIXED,
      createdAt: FIXED,
      updatedAt: FIXED,
      items: [...input.items],
    });
    this.store.set(pr.id, pr);
    return pr;
  }

  async update(pr: PurchaseRequest): Promise<void> {
    this.store.set(pr.id, pr);
  }

  async findById(id: number, companyId: number): Promise<PurchaseRequest | null> {
    const pr = this.store.get(id);
    return pr && pr.companyId === companyId ? pr : null;
  }

  async listByCompany(
    companyId: number,
    options?: ListPurchaseRequestsOptions,
  ): Promise<ReadonlyArray<PurchaseRequest>> {
    let list = [...this.store.values()].filter((p) => p.companyId === companyId);
    if (options?.status !== undefined) list = list.filter((p) => p.status === options.status);
    if (options?.requesterUserId !== undefined)
      list = list.filter((p) => p.requesterUserId === options.requesterUserId);
    return list;
  }

  async countByNoPrefix(companyId: number, prefix: string): Promise<number> {
    return [...this.store.values()].filter(
      (p) => p.companyId === companyId && p.prNo.startsWith(prefix),
    ).length;
  }

  async delete(id: number, companyId: number): Promise<void> {
    const pr = this.store.get(id);
    if (pr && pr.companyId === companyId) this.store.delete(id);
  }
}

export class InMemoryPurchaseOrderRepository implements PurchaseOrderRepository {
  private seq = 0;
  private readonly store = new Map<number, PurchaseOrder>();

  async insert(input: NewPurchaseOrderInput): Promise<PurchaseOrder> {
    this.seq += 1;
    const po = PurchaseOrder.create({
      id: this.seq,
      companyId: input.companyId,
      poNo: input.poNo,
      vendorId: input.vendorId,
      prId: input.prId,
      status: input.status,
      currency: input.currency,
      note: input.note,
      orderedAt: input.orderedAt,
      deliveredAt: null,
      createdBy: input.createdBy,
      createdAt: FIXED,
      updatedAt: FIXED,
      lines: [...input.lines],
    });
    this.store.set(po.id, po);
    return po;
  }

  async update(po: PurchaseOrder): Promise<void> {
    this.store.set(po.id, po);
  }

  async findById(id: number, companyId: number): Promise<PurchaseOrder | null> {
    const po = this.store.get(id);
    return po && po.companyId === companyId ? po : null;
  }

  async listByCompany(
    companyId: number,
    options?: ListPurchaseOrdersOptions,
  ): Promise<ReadonlyArray<PurchaseOrder>> {
    let list = [...this.store.values()].filter((p) => p.companyId === companyId);
    if (options?.status !== undefined) list = list.filter((p) => p.status === options.status);
    if (options?.vendorId !== undefined) list = list.filter((p) => p.vendorId === options.vendorId);
    return list;
  }

  async countByNoPrefix(companyId: number, prefix: string): Promise<number> {
    return [...this.store.values()].filter(
      (p) => p.companyId === companyId && p.poNo.startsWith(prefix),
    ).length;
  }
}
