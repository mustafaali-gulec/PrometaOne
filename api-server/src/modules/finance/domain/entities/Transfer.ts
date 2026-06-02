/**
 * Transfer — hesaplar arası transfer (004_banks_kasa_transfers.sql).
 *
 * banka↔kasa, banka↔banka, kasa↔kasa olabilir. Çoklu para birimi: from ve to
 * farklı currency olabilir (örn. TRY hesaptan USD hesaba), bu yüzden fromAmount
 * ve toAmount AYRI Money'dir. Aynı hesaba transfer yasak (DB CHECK ile uyumlu).
 */
import type { EndpointType } from '../valueObjects/EndpointType.js';
import type { Money } from '../valueObjects/Money.js';

export interface TransferProps {
  id: number | null;
  companyId: number;
  date: string; // YYYY-MM-DD
  fromType: EndpointType;
  fromId: number;
  toType: EndpointType;
  toId: number;
  fromAmount: Money;
  toAmount: Money;
  description: string | null;
  cashflowCatId: number | null;
  committedToCells: boolean;
  committedAt: Date | null;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Transfer {
  private constructor(private readonly props: Readonly<TransferProps>) {}

  static create(props: TransferProps): Transfer {
    if (props.id !== null && props.id <= 0) {
      throw new Error('Transfer.id pozitif olmalı veya null');
    }
    if (props.companyId <= 0) {
      throw new Error('Transfer.companyId pozitif olmalı');
    }
    if (props.fromId <= 0 || props.toId <= 0) {
      throw new Error('Transfer.fromId ve toId pozitif olmalı');
    }
    if (props.fromType === props.toType && props.fromId === props.toId) {
      throw new Error('Aynı hesaba transfer yapılamaz');
    }
    if (!props.fromAmount.isPositive() || !props.toAmount.isPositive()) {
      throw new Error('Transfer fromAmount ve toAmount pozitif olmalı');
    }
    return new Transfer(props);
  }

  get id(): number | null {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get date(): string {
    return this.props.date;
  }
  get fromType(): EndpointType {
    return this.props.fromType;
  }
  get fromId(): number {
    return this.props.fromId;
  }
  get toType(): EndpointType {
    return this.props.toType;
  }
  get toId(): number {
    return this.props.toId;
  }
  get fromAmount(): Money {
    return this.props.fromAmount;
  }
  get toAmount(): Money {
    return this.props.toAmount;
  }
  get description(): string | null {
    return this.props.description;
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

  /** Bir endpoint bu transferin kaynağı mı? */
  isFrom(type: EndpointType, id: number): boolean {
    return this.props.fromType === type && this.props.fromId === id;
  }

  /** Bir endpoint bu transferin hedefi mi? */
  isTo(type: EndpointType, id: number): boolean {
    return this.props.toType === type && this.props.toId === id;
  }

  markCommitted(now: Date): Transfer {
    if (this.props.committedToCells) {
      return this;
    }
    return new Transfer({ ...this.props, committedToCells: true, committedAt: now });
  }

  withId(id: number): Transfer {
    if (this.props.id === id) {
      return this;
    }
    return new Transfer({ ...this.props, id });
  }

  toJSON(): {
    id: number | null;
    companyId: number;
    date: string;
    fromType: EndpointType;
    fromId: number;
    toType: EndpointType;
    toId: number;
    fromAmount: string;
    toAmount: string;
    description: string | null;
    committedToCells: boolean;
  } {
    return {
      id: this.props.id,
      companyId: this.props.companyId,
      date: this.props.date,
      fromType: this.props.fromType,
      fromId: this.props.fromId,
      toType: this.props.toType,
      toId: this.props.toId,
      fromAmount: this.props.fromAmount.toDecimalString(),
      toAmount: this.props.toAmount.toDecimalString(),
      description: this.props.description,
      committedToCells: this.props.committedToCells,
    };
  }
}
