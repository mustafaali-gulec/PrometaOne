/**
 * BankAccount — şirket banka hesabı (004_banks_kasa_transfers.sql).
 *
 * openingBalance Money olarak tutulur (hesabın currency'sinde). Güncel bakiye
 * CashPositionCalculator ile transfer/entry hareketlerinden hesaplanır (saklanmaz).
 *
 * Immutable — rename/archive yeni instance döner.
 */
import type { Currency } from '../valueObjects/Currency.js';
import type { Money } from '../valueObjects/Money.js';

export interface BankAccountProps {
  id: number;
  companyId: number;
  bankId: number;
  name: string;
  iban: string | null;
  accountNo: string | null;
  currency: Currency;
  openingBalance: Money;
  cashflowCatId: number | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class BankAccount {
  private constructor(private readonly props: Readonly<BankAccountProps>) {}

  static create(props: BankAccountProps): BankAccount {
    if (props.id <= 0) {
      throw new Error('BankAccount.id pozitif olmalı');
    }
    if (props.companyId <= 0) {
      throw new Error('BankAccount.companyId pozitif olmalı');
    }
    if (props.bankId <= 0) {
      throw new Error('BankAccount.bankId pozitif olmalı');
    }
    if (props.name.trim().length === 0) {
      throw new Error('BankAccount.name boş olamaz');
    }
    if (props.openingBalance.currency !== props.currency) {
      throw new Error('BankAccount.openingBalance currency hesap currency ile eşleşmeli');
    }
    return new BankAccount(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get bankId(): number {
    return this.props.bankId;
  }
  get name(): string {
    return this.props.name;
  }
  get iban(): string | null {
    return this.props.iban;
  }
  get accountNo(): string | null {
    return this.props.accountNo;
  }
  get currency(): Currency {
    return this.props.currency;
  }
  get openingBalance(): Money {
    return this.props.openingBalance;
  }
  get cashflowCatId(): number | null {
    return this.props.cashflowCatId;
  }
  get active(): boolean {
    return this.props.active;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  rename(newName: string, now: Date): BankAccount {
    const trimmed = newName.trim();
    if (trimmed.length === 0) {
      throw new Error('BankAccount.name boş olamaz');
    }
    if (trimmed === this.props.name) {
      return this;
    }
    return new BankAccount({ ...this.props, name: trimmed, updatedAt: now });
  }

  archive(now: Date): BankAccount {
    if (!this.props.active) {
      return this;
    }
    return new BankAccount({ ...this.props, active: false, updatedAt: now });
  }

  reactivate(now: Date): BankAccount {
    if (this.props.active) {
      return this;
    }
    return new BankAccount({ ...this.props, active: true, updatedAt: now });
  }

  toJSON(): {
    id: number;
    companyId: number;
    bankId: number;
    name: string;
    iban: string | null;
    accountNo: string | null;
    currency: Currency;
    openingBalance: string;
    cashflowCatId: number | null;
    active: boolean;
  } {
    return {
      id: this.props.id,
      companyId: this.props.companyId,
      bankId: this.props.bankId,
      name: this.props.name,
      iban: this.props.iban,
      accountNo: this.props.accountNo,
      currency: this.props.currency,
      openingBalance: this.props.openingBalance.toDecimalString(),
      cashflowCatId: this.props.cashflowCatId,
      active: this.props.active,
    };
  }
}
