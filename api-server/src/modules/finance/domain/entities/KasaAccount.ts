/**
 * KasaAccount — şirket kasa (nakit) hesabı (004_banks_kasa_transfers.sql).
 *
 * openingBalance Money (hesap currency'sinde). Güncel bakiye
 * CashPositionCalculator ile hesaplanır.
 */
import type { Currency } from '../valueObjects/Currency.js';
import type { Money } from '../valueObjects/Money.js';

export interface KasaAccountProps {
  id: number;
  companyId: number;
  name: string;
  currency: Currency;
  openingBalance: Money;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class KasaAccount {
  private constructor(private readonly props: Readonly<KasaAccountProps>) {}

  static create(props: KasaAccountProps): KasaAccount {
    if (props.id <= 0) {
      throw new Error('KasaAccount.id pozitif olmalı');
    }
    if (props.companyId <= 0) {
      throw new Error('KasaAccount.companyId pozitif olmalı');
    }
    if (props.name.trim().length === 0) {
      throw new Error('KasaAccount.name boş olamaz');
    }
    if (props.openingBalance.currency !== props.currency) {
      throw new Error('KasaAccount.openingBalance currency hesap currency ile eşleşmeli');
    }
    return new KasaAccount(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get name(): string {
    return this.props.name;
  }
  get currency(): Currency {
    return this.props.currency;
  }
  get openingBalance(): Money {
    return this.props.openingBalance;
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

  rename(newName: string, now: Date): KasaAccount {
    const trimmed = newName.trim();
    if (trimmed.length === 0) {
      throw new Error('KasaAccount.name boş olamaz');
    }
    if (trimmed === this.props.name) {
      return this;
    }
    return new KasaAccount({ ...this.props, name: trimmed, updatedAt: now });
  }

  archive(now: Date): KasaAccount {
    if (!this.props.active) {
      return this;
    }
    return new KasaAccount({ ...this.props, active: false, updatedAt: now });
  }

  reactivate(now: Date): KasaAccount {
    if (this.props.active) {
      return this;
    }
    return new KasaAccount({ ...this.props, active: true, updatedAt: now });
  }

  toJSON(): {
    id: number;
    companyId: number;
    name: string;
    currency: Currency;
    openingBalance: string;
    active: boolean;
  } {
    return {
      id: this.props.id,
      companyId: this.props.companyId,
      name: this.props.name,
      currency: this.props.currency,
      openingBalance: this.props.openingBalance.toDecimalString(),
      active: this.props.active,
    };
  }
}
