/**
 * Invoice — fatura (005_invoices.sql).
 *
 * type: FlowDirection
 *   in  → alacak (AR) — tahsil edilecek (müşteri faturası)
 *   out → borç (AP)   — ödenecek (tedarikçi faturası)
 *
 * Tutarlar Money (integer kuruş). Invariant: total = subtotal + kdv.
 * paidAmount 0..total arası (yuvarlama toleransı total + 1 kuruş).
 *
 * paidAmount değişimi domain'de applyPayment/removePayment ile yapılır;
 * DB'de trigger da paid_amount'u senkron tutar (PR 6 — çift kontrol).
 */
import type { Currency } from '../valueObjects/Currency.js';
import type { FlowDirection } from '../valueObjects/FlowDirection.js';
import type { KdvRate } from '../valueObjects/KdvRate.js';
import { Money } from '../valueObjects/Money.js';

export interface InvoiceProps {
  id: number | null;
  companyId: number;
  type: FlowDirection;
  invoiceNo: string | null;
  counterparty: string;
  issueDate: string | null; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  currency: Currency;
  subtotal: Money;
  kdvRate: KdvRate;
  kdv: Money;
  total: Money;
  paidAmount: Money;
  cashflowCatId: number | null;
  committedToCells: boolean;
  committedAt: Date | null;
  note: string | null;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Invoice {
  private constructor(private readonly props: Readonly<InvoiceProps>) {}

  static create(props: InvoiceProps): Invoice {
    if (props.id !== null && props.id <= 0) {
      throw new Error('Invoice.id pozitif olmalı veya null');
    }
    if (props.companyId <= 0) {
      throw new Error('Invoice.companyId pozitif olmalı');
    }
    if (props.counterparty.trim().length === 0) {
      throw new Error('Invoice.counterparty boş olamaz');
    }
    // Para birimi tutarlılığı
    for (const [label, money] of [
      ['subtotal', props.subtotal],
      ['kdv', props.kdv],
      ['total', props.total],
      ['paidAmount', props.paidAmount],
    ] as const) {
      if (money.currency !== props.currency) {
        throw new Error(`Invoice.${label} currency fatura currency ile eşleşmeli`);
      }
    }
    // total = subtotal + kdv invariant'ı
    if (!props.total.equals(props.subtotal.plus(props.kdv))) {
      throw new Error('Invoice.total subtotal + kdv olmalı');
    }
    if (!props.total.isPositive()) {
      throw new Error('Invoice.total pozitif olmalı');
    }
    if (props.paidAmount.isNegative()) {
      throw new Error('Invoice.paidAmount negatif olamaz');
    }
    // paidAmount <= total + 1 kuruş tolerans
    if (props.paidAmount.isGreaterThan(props.total.plus(Money.fromMinor(1, props.currency)))) {
      throw new Error('Invoice.paidAmount total değeri aşamaz');
    }
    return new Invoice(props);
  }

  get id(): number | null {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get type(): FlowDirection {
    return this.props.type;
  }
  get invoiceNo(): string | null {
    return this.props.invoiceNo;
  }
  get counterparty(): string {
    return this.props.counterparty;
  }
  get issueDate(): string | null {
    return this.props.issueDate;
  }
  get dueDate(): string {
    return this.props.dueDate;
  }
  get currency(): Currency {
    return this.props.currency;
  }
  get subtotal(): Money {
    return this.props.subtotal;
  }
  get kdvRate(): KdvRate {
    return this.props.kdvRate;
  }
  get kdv(): Money {
    return this.props.kdv;
  }
  get total(): Money {
    return this.props.total;
  }
  get paidAmount(): Money {
    return this.props.paidAmount;
  }
  get cashflowCatId(): number | null {
    return this.props.cashflowCatId;
  }
  get committedToCells(): boolean {
    return this.props.committedToCells;
  }
  get committedAt(): Date | null {
    return this.props.committedAt;
  }
  get note(): string | null {
    return this.props.note;
  }
  get createdBy(): number | null {
    return this.props.createdBy;
  }

  /** Kalan tutar: total − paidAmount (negatife düşmez). */
  remaining(): Money {
    const r = this.props.total.minus(this.props.paidAmount);
    return r.isNegative() ? Money.zero(this.props.currency) : r;
  }

  /** Ödeme uygula — yeni paidAmount total'i aşamaz (tolerans 1 kuruş). */
  applyPayment(amount: Money, now: Date): Invoice {
    if (amount.currency !== this.props.currency) {
      throw new Error('Ödeme currency fatura currency ile eşleşmeli');
    }
    if (!amount.isPositive()) {
      throw new Error('Ödeme tutarı pozitif olmalı');
    }
    const newPaid = this.props.paidAmount.plus(amount);
    if (newPaid.isGreaterThan(this.props.total.plus(Money.fromMinor(1, this.props.currency)))) {
      throw new Error('Ödeme toplamı fatura tutarını aşamaz');
    }
    return new Invoice({ ...this.props, paidAmount: newPaid, updatedAt: now });
  }

  /** Ödeme geri al (silme). paidAmount negatife düşmez. */
  removePayment(amount: Money, now: Date): Invoice {
    if (amount.currency !== this.props.currency) {
      throw new Error('Ödeme currency fatura currency ile eşleşmeli');
    }
    const newPaid = this.props.paidAmount.minus(amount);
    const clamped = newPaid.isNegative() ? Money.zero(this.props.currency) : newPaid;
    return new Invoice({ ...this.props, paidAmount: clamped, updatedAt: now });
  }

  markCommitted(now: Date): Invoice {
    if (this.props.committedToCells) {
      return this;
    }
    return new Invoice({ ...this.props, committedToCells: true, committedAt: now });
  }

  withId(id: number): Invoice {
    if (this.props.id === id) {
      return this;
    }
    return new Invoice({ ...this.props, id });
  }

  toJSON(): {
    id: number | null;
    companyId: number;
    type: FlowDirection;
    invoiceNo: string | null;
    counterparty: string;
    issueDate: string | null;
    dueDate: string;
    currency: Currency;
    subtotal: string;
    kdvRate: number;
    kdv: string;
    total: string;
    paidAmount: string;
    remaining: string;
    cashflowCatId: number | null;
    committedToCells: boolean;
    note: string | null;
  } {
    return {
      id: this.props.id,
      companyId: this.props.companyId,
      type: this.props.type,
      invoiceNo: this.props.invoiceNo,
      counterparty: this.props.counterparty,
      issueDate: this.props.issueDate,
      dueDate: this.props.dueDate,
      currency: this.props.currency,
      subtotal: this.props.subtotal.toDecimalString(),
      kdvRate: this.props.kdvRate.value,
      kdv: this.props.kdv.toDecimalString(),
      total: this.props.total.toDecimalString(),
      paidAmount: this.props.paidAmount.toDecimalString(),
      remaining: this.remaining().toDecimalString(),
      cashflowCatId: this.props.cashflowCatId,
      committedToCells: this.props.committedToCells,
      note: this.props.note,
    };
  }
}
