/**
 * InvoicePayment — fatura ödemesi (005_invoices.sql invoice_payments).
 *
 * Bir ödeme bir banka hesabına VEYA kasa hesabına bağlanabilir (ikisi
 * birden değil), ya da hiçbirine (serbest kayıt). DB CHECK ile uyumlu.
 */
import type { Currency } from '../valueObjects/Currency.js';
import type { Money } from '../valueObjects/Money.js';

export interface InvoicePaymentProps {
  id: number | null;
  invoiceId: number;
  amount: Money;
  date: string; // YYYY-MM-DD
  currency: Currency;
  bankAccountId: number | null;
  kasaAccountId: number | null;
  note: string | null;
  createdBy: number | null;
  createdAt: Date;
}

export class InvoicePayment {
  private constructor(private readonly props: Readonly<InvoicePaymentProps>) {}

  static create(props: InvoicePaymentProps): InvoicePayment {
    if (props.id !== null && props.id <= 0) {
      throw new Error('InvoicePayment.id pozitif olmalı veya null');
    }
    if (props.invoiceId <= 0) {
      throw new Error('InvoicePayment.invoiceId pozitif olmalı');
    }
    if (!props.amount.isPositive()) {
      throw new Error('InvoicePayment.amount pozitif olmalı');
    }
    if (props.amount.currency !== props.currency) {
      throw new Error('InvoicePayment.amount currency ödeme currency ile eşleşmeli');
    }
    if (props.bankAccountId !== null && props.kasaAccountId !== null) {
      throw new Error('Ödeme aynı anda hem banka hem kasa hesabına bağlanamaz');
    }
    return new InvoicePayment(props);
  }

  get id(): number | null {
    return this.props.id;
  }
  get invoiceId(): number {
    return this.props.invoiceId;
  }
  get amount(): Money {
    return this.props.amount;
  }
  get date(): string {
    return this.props.date;
  }
  get currency(): Currency {
    return this.props.currency;
  }
  get bankAccountId(): number | null {
    return this.props.bankAccountId;
  }
  get kasaAccountId(): number | null {
    return this.props.kasaAccountId;
  }
  get note(): string | null {
    return this.props.note;
  }
  get createdBy(): number | null {
    return this.props.createdBy;
  }

  withId(id: number): InvoicePayment {
    if (this.props.id === id) {
      return this;
    }
    return new InvoicePayment({ ...this.props, id });
  }

  toJSON(): {
    id: number | null;
    invoiceId: number;
    amount: string;
    date: string;
    currency: Currency;
    bankAccountId: number | null;
    kasaAccountId: number | null;
    note: string | null;
  } {
    return {
      id: this.props.id,
      invoiceId: this.props.invoiceId,
      amount: this.props.amount.toDecimalString(),
      date: this.props.date,
      currency: this.props.currency,
      bankAccountId: this.props.bankAccountId,
      kasaAccountId: this.props.kasaAccountId,
      note: this.props.note,
    };
  }
}
