/**
 * KasaEntry — kasa hareketi (004_banks_kasa_transfers.sql).
 *
 * Bir kasa hesabına giriş (in) veya çıkış (out). amount DAİMA pozitif Money;
 * yön `type` (FlowDirection) ile belirlenir. `committedToCells` — bu hareketin
 * bütçe hücresine yansıtılıp yansıtılmadığı (PR 5 commit-to-cells).
 */
import type { FlowDirection } from '../valueObjects/FlowDirection.js';
import type { Money } from '../valueObjects/Money.js';

export interface KasaEntryProps {
  id: number | null;
  kasaAccountId: number;
  date: string; // YYYY-MM-DD
  type: FlowDirection;
  amount: Money;
  description: string | null;
  category: string | null;
  cashflowCatId: number | null;
  committedToCells: boolean;
  committedAt: Date | null;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export class KasaEntry {
  private constructor(private readonly props: Readonly<KasaEntryProps>) {}

  static create(props: KasaEntryProps): KasaEntry {
    if (props.id !== null && props.id <= 0) {
      throw new Error('KasaEntry.id pozitif olmalı veya null');
    }
    if (props.kasaAccountId <= 0) {
      throw new Error('KasaEntry.kasaAccountId pozitif olmalı');
    }
    if (!props.amount.isPositive()) {
      throw new Error('KasaEntry.amount pozitif olmalı (yön type ile belirlenir)');
    }
    return new KasaEntry(props);
  }

  get id(): number | null {
    return this.props.id;
  }
  get kasaAccountId(): number {
    return this.props.kasaAccountId;
  }
  get date(): string {
    return this.props.date;
  }
  get type(): FlowDirection {
    return this.props.type;
  }
  get amount(): Money {
    return this.props.amount;
  }
  get description(): string | null {
    return this.props.description;
  }
  get category(): string | null {
    return this.props.category;
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
  get createdBy(): number | null {
    return this.props.createdBy;
  }

  /**
   * Bakiye etkisi: in → +amount, out → −amount (hesabın currency'sinde).
   */
  signedAmount(): Money {
    return this.props.type === 'in' ? this.props.amount : this.props.amount.negate();
  }

  /** Bütçe hücresine yansıtıldı olarak işaretle (PR 5). */
  markCommitted(now: Date): KasaEntry {
    if (this.props.committedToCells) {
      return this;
    }
    return new KasaEntry({ ...this.props, committedToCells: true, committedAt: now });
  }

  withId(id: number): KasaEntry {
    if (this.props.id === id) {
      return this;
    }
    return new KasaEntry({ ...this.props, id });
  }

  toJSON(): {
    id: number | null;
    kasaAccountId: number;
    date: string;
    type: FlowDirection;
    amount: string;
    description: string | null;
    category: string | null;
    cashflowCatId: number | null;
    committedToCells: boolean;
  } {
    return {
      id: this.props.id,
      kasaAccountId: this.props.kasaAccountId,
      date: this.props.date,
      type: this.props.type,
      amount: this.props.amount.toDecimalString(),
      description: this.props.description,
      category: this.props.category,
      cashflowCatId: this.props.cashflowCatId,
      committedToCells: this.props.committedToCells,
    };
  }
}
