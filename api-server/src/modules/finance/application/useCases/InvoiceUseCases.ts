/**
 * Invoice use-case'leri (Faz 5 / PR 4).
 *
 * CreateInvoice (KDV hesapla), RecordPayment (paid_amount güncelle),
 * DeletePayment, ListInvoices (status), GetOverdueInvoices.
 *
 * NOT — RecordPayment iki tablo yazar (payment insert + invoice.paidAmount
 * update). Gerçek PG'de (PR 6) `invoice_payments` trigger'ı paid_amount'u
 * otomatik tutar; domain update'i ile uyum + atomiklik PR 6'da UoW ile
 * sağlanır. Fake'lerde sıralı yazım yeterli.
 */
import { Invoice } from '../../domain/entities/Invoice.js';
import { InvoicePayment } from '../../domain/entities/InvoicePayment.js';
import {
  InvoiceNotFoundError,
  InvoicePaymentNotFoundError,
} from '../../domain/errors/FinanceErrors.js';
import { InvoiceStatusPolicy } from '../../domain/services/InvoiceStatusPolicy.js';
import { KdvCalculator } from '../../domain/services/KdvCalculator.js';
import type { Currency } from '../../domain/valueObjects/Currency.js';
import type { FlowDirection } from '../../domain/valueObjects/FlowDirection.js';
import { KdvRate } from '../../domain/valueObjects/KdvRate.js';
import { Money } from '../../domain/valueObjects/Money.js';
import {
  toInvoiceDto,
  toInvoicePaymentDto,
  type InvoiceDto,
  type InvoicePaymentDto,
} from '../dto/InvoiceDtos.js';
import type { Clock } from '../ports/Clock.js';
import type { InvoicePaymentRepository, InvoiceRepository } from '../ports/InvoiceRepositories.js';

function todayStr(clock: Clock): string {
  return clock.now().toISOString().slice(0, 10);
}

export interface CreateInvoiceInput {
  companyId: number;
  type: FlowDirection;
  invoiceNo?: string | null;
  counterparty: string;
  issueDate?: string | null;
  dueDate: string;
  currency: Currency;
  /** KDV hariç ara toplam (major). */
  subtotal: number;
  /** KDV oranı 0–1 (varsayılan 0.20). */
  kdvRate?: number;
  cashflowCatId?: number | null;
  note?: string | null;
  actorUserId: number | null;
}

export class CreateInvoiceUseCase {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateInvoiceInput): Promise<InvoiceDto> {
    const now = this.clock.now();
    const subtotal = Money.fromMajor(input.subtotal, input.currency);
    const rate = input.kdvRate !== undefined ? KdvRate.create(input.kdvRate) : KdvRate.default();
    const totals = KdvCalculator.fromSubtotal(subtotal, rate);

    const invoice = Invoice.create({
      id: null,
      companyId: input.companyId,
      type: input.type,
      invoiceNo: input.invoiceNo ?? null,
      counterparty: input.counterparty.trim(),
      issueDate: input.issueDate ?? null,
      dueDate: input.dueDate,
      currency: input.currency,
      subtotal: totals.subtotal,
      kdvRate: rate,
      kdv: totals.kdv,
      total: totals.total,
      paidAmount: Money.zero(input.currency),
      cashflowCatId: input.cashflowCatId ?? null,
      committedToCells: false,
      committedAt: null,
      note: input.note ?? null,
      createdBy: input.actorUserId,
      createdAt: now,
      updatedAt: now,
    });
    const persisted = await this.invoices.insert(invoice);
    return toInvoiceDto(persisted, todayStr(this.clock));
  }
}

export interface RecordPaymentInput {
  companyId: number;
  invoiceId: number;
  amount: number;
  date: string;
  bankAccountId?: number | null;
  kasaAccountId?: number | null;
  note?: string | null;
  actorUserId: number | null;
}

export interface RecordPaymentResult {
  invoice: InvoiceDto;
  payment: InvoicePaymentDto;
}

export class RecordPaymentUseCase {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly payments: InvoicePaymentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: RecordPaymentInput): Promise<RecordPaymentResult> {
    const invoice = await this.invoices.findById(input.invoiceId, input.companyId);
    if (!invoice) {
      throw new InvoiceNotFoundError(input.invoiceId);
    }
    const now = this.clock.now();
    const amount = Money.fromMajor(input.amount, invoice.currency);

    // 1) Ödeme kaydı (entity bank XOR kasa + pozitif tutar invariant'larını uygular)
    const payment = InvoicePayment.create({
      id: null,
      invoiceId: invoice.id!,
      amount,
      date: input.date,
      currency: invoice.currency,
      bankAccountId: input.bankAccountId ?? null,
      kasaAccountId: input.kasaAccountId ?? null,
      note: input.note ?? null,
      createdBy: input.actorUserId,
      createdAt: now,
    });
    const persistedPayment = await this.payments.insert(payment);

    // 2) Fatura paidAmount güncelle (applyPayment total aşımını reddeder)
    const updatedInvoice = invoice.applyPayment(amount, now);
    await this.invoices.update(updatedInvoice);

    return {
      invoice: toInvoiceDto(updatedInvoice, todayStr(this.clock)),
      payment: toInvoicePaymentDto(persistedPayment),
    };
  }
}

export interface DeletePaymentInput {
  companyId: number;
  paymentId: number;
}

export class DeletePaymentUseCase {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly payments: InvoicePaymentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: DeletePaymentInput): Promise<InvoiceDto> {
    const payment = await this.payments.findById(input.paymentId);
    if (!payment) {
      throw new InvoicePaymentNotFoundError(input.paymentId);
    }
    const invoice = await this.invoices.findById(payment.invoiceId, input.companyId);
    if (!invoice) {
      throw new InvoiceNotFoundError(payment.invoiceId);
    }
    const now = this.clock.now();
    await this.payments.remove(input.paymentId);
    const updatedInvoice = invoice.removePayment(payment.amount, now);
    await this.invoices.update(updatedInvoice);
    return toInvoiceDto(updatedInvoice, todayStr(this.clock));
  }
}

export interface ListInvoicesInput {
  companyId: number;
  type?: FlowDirection;
  openOnly?: boolean;
}

export class ListInvoicesUseCase {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: ListInvoicesInput): Promise<InvoiceDto[]> {
    const today = todayStr(this.clock);
    const list = await this.invoices.listByCompany(input.companyId, {
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.openOnly !== undefined ? { openOnly: input.openOnly } : {}),
    });
    return list.map((inv) => toInvoiceDto(inv, today));
  }
}

export class GetOverdueInvoicesUseCase {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: { companyId: number }): Promise<InvoiceDto[]> {
    const today = todayStr(this.clock);
    const list = await this.invoices.listByCompany(input.companyId, { openOnly: true });
    return list
      .filter((inv) => InvoiceStatusPolicy.status(inv, today) === 'overdue')
      .map((inv) => toInvoiceDto(inv, today));
  }
}
