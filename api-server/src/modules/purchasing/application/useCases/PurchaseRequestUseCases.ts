/**
 * Satınalma talebi (PR) use-case'leri.
 *
 * CreatePurchaseRequest otomatik PR numarası üretir (PR-YYYY-NNNN). submit=true
 * ise talep doğrudan onaya gönderilir (pending_approval). ChangePrStatus statü
 * geçiş kurallarını (PrStatus) uygular.
 */
import {
  PurchaseRequest,
  type PurchaseRequestItem,
} from '../../domain/entities/PurchaseRequest.js';
import { PurchaseRequestNotFoundError } from '../../domain/errors/PurchasingErrors.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';
import type { PrStatus } from '../../domain/valueObjects/PrStatus.js';
import { toPurchaseRequestDto, type PurchaseRequestDto } from '../dto/PurchaseRequestDtos.js';
import type { Clock } from '../ports/Clock.js';
import type {
  ListPurchaseRequestsOptions,
  PurchaseRequestRepository,
} from '../ports/PurchaseRequestRepository.js';

export interface PrItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  note?: string | null | undefined;
}

function toItems(items: ReadonlyArray<PrItemInput>): PurchaseRequestItem[] {
  return items.map((it, idx) => ({
    lineNo: idx + 1,
    description: it.description.trim(),
    quantity: Number(it.quantity) || 0,
    unitPrice: Number(it.unitPrice) || 0,
    note: it.note?.trim() || null,
  }));
}

function parseDateOnly(s: string | null | undefined): Date | null {
  if (!s) return null;
  return new Date(`${s}T00:00:00.000Z`);
}

export interface CreatePurchaseRequestInput {
  companyId: number;
  requesterUserId?: number | null | undefined;
  departmentId?: number | null | undefined;
  category?: string | undefined;
  priority?: string | undefined;
  currency?: CurrencyCode | undefined;
  justification?: string | null | undefined;
  requiredBy?: string | null | undefined;
  items: PrItemInput[];
  /** true → doğrudan onaya gönder (pending_approval) */
  submit?: boolean | undefined;
}

export class CreatePurchaseRequestUseCase {
  constructor(
    private readonly prs: PurchaseRequestRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreatePurchaseRequestInput): Promise<PurchaseRequestDto> {
    const year = this.clock.now().getFullYear();
    const prefix = `PR-${year}-`;
    const seq = (await this.prs.countByNoPrefix(input.companyId, prefix)) + 1;
    const prNo = `${prefix}${String(seq).padStart(4, '0')}`;

    const created = await this.prs.insert({
      companyId: input.companyId,
      prNo,
      requesterUserId: input.requesterUserId ?? null,
      departmentId: input.departmentId ?? null,
      category: input.category ?? 'other',
      priority: input.priority ?? 'normal',
      status: input.submit ? 'pending_approval' : 'draft',
      currency: input.currency ?? 'TRY',
      justification: input.justification?.trim() || null,
      requiredBy: parseDateOnly(input.requiredBy),
      items: toItems(input.items),
    });
    return toPurchaseRequestDto(created);
  }
}

export interface ListPurchaseRequestsInput {
  companyId: number;
  status?: PrStatus;
  requesterUserId?: number;
}

export class ListPurchaseRequestsUseCase {
  constructor(private readonly prs: PurchaseRequestRepository) {}

  async execute(input: ListPurchaseRequestsInput): Promise<PurchaseRequestDto[]> {
    const options: ListPurchaseRequestsOptions = {};
    if (input.status !== undefined) options.status = input.status;
    if (input.requesterUserId !== undefined) options.requesterUserId = input.requesterUserId;
    const list = await this.prs.listByCompany(input.companyId, options);
    return list.map(toPurchaseRequestDto);
  }
}

export interface UpdatePurchaseRequestInput {
  companyId: number;
  prId: number;
  category?: string | undefined;
  priority?: string | undefined;
  currency?: CurrencyCode | undefined;
  justification?: string | null | undefined;
  requiredBy?: string | null | undefined;
  items?: PrItemInput[] | undefined;
}

export class UpdatePurchaseRequestUseCase {
  constructor(
    private readonly prs: PurchaseRequestRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdatePurchaseRequestInput): Promise<PurchaseRequestDto> {
    const pr = await this.prs.findById(input.prId, input.companyId);
    if (!pr) throw new PurchaseRequestNotFoundError(input.prId);
    const j = pr.toJSON();
    const updated = PurchaseRequest.create({
      ...j,
      category: input.category ?? j.category,
      priority: input.priority ?? j.priority,
      currency: input.currency ?? j.currency,
      justification:
        input.justification !== undefined ? input.justification?.trim() || null : j.justification,
      requiredBy: input.requiredBy !== undefined ? parseDateOnly(input.requiredBy) : j.requiredBy,
      items: input.items !== undefined ? toItems(input.items) : j.items,
      updatedAt: this.clock.now(),
    });
    await this.prs.update(updated);
    return toPurchaseRequestDto(updated);
  }
}

export interface ChangePrStatusInput {
  companyId: number;
  prId: number;
  status: PrStatus;
}

export class ChangePrStatusUseCase {
  constructor(
    private readonly prs: PurchaseRequestRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: ChangePrStatusInput): Promise<PurchaseRequestDto> {
    const pr = await this.prs.findById(input.prId, input.companyId);
    if (!pr) throw new PurchaseRequestNotFoundError(input.prId);
    const updated = pr.changeStatus(input.status, this.clock.now());
    await this.prs.update(updated);
    return toPurchaseRequestDto(updated);
  }
}
