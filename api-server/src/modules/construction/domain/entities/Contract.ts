/**
 * Contract — Sözleşme (işveren/taşeron). Tablo: cs_contracts + cs_tender_info.
 *
 * KİK/ihaleli işlerde `tender` (1-1) doldurulur; özel projelerde null. Karşı
 * taraf cari `vendorId` ile vendors tablosuna bağlanır. Immutable.
 */
import type { ContractParty } from '../valueObjects/ContractParty.js';
import type { CurrencyCode } from '../valueObjects/Currency.js';

export interface TenderInfoProps {
  ikn: string | null;
  procedure: string | null;
  approxCost: number | null;
  tenderDate: string | null;
  workIncreasePct: number;
  perfBondPct: number;
  notes: string | null;
}

export interface ContractProps {
  id: number;
  companyId: number;
  projectId: number;
  partyKind: ContractParty;
  vendorId: number | null;
  contractNo: string;
  title: string;
  amount: number;
  currency: CurrencyCode;
  signDate: string | null;
  startDate: string | null;
  endDate: string | null;
  retentionPct: number;
  advancePct: number;
  priceDiffOn: boolean;
  tender: TenderInfoProps | null;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContractUpdate {
  title?: string;
  vendorId?: number | null;
  amount?: number;
  currency?: CurrencyCode;
  signDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  retentionPct?: number;
  advancePct?: number;
  priceDiffOn?: boolean;
  tender?: TenderInfoProps | null;
}

export class Contract {
  private constructor(private readonly props: Readonly<ContractProps>) {}

  static create(props: ContractProps): Contract {
    if (props.id <= 0) throw new Error('Contract.id pozitif olmalı');
    if (props.companyId <= 0) throw new Error('Contract.companyId pozitif olmalı');
    if (props.projectId <= 0) throw new Error('Contract.projectId pozitif olmalı');
    if (props.contractNo.trim().length === 0) throw new Error('Contract.contractNo boş olamaz');
    if (props.title.trim().length === 0) throw new Error('Contract.title boş olamaz');
    if (props.amount < 0) throw new Error('Contract.amount negatif olamaz');
    if (props.retentionPct < 0 || props.advancePct < 0) {
      throw new Error('Contract oranları negatif olamaz');
    }
    return new Contract(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get projectId(): number {
    return this.props.projectId;
  }
  get partyKind(): ContractParty {
    return this.props.partyKind;
  }
  get vendorId(): number | null {
    return this.props.vendorId;
  }
  get contractNo(): string {
    return this.props.contractNo;
  }
  get title(): string {
    return this.props.title;
  }
  get amount(): number {
    return this.props.amount;
  }
  get currency(): CurrencyCode {
    return this.props.currency;
  }
  get signDate(): string | null {
    return this.props.signDate;
  }
  get startDate(): string | null {
    return this.props.startDate;
  }
  get endDate(): string | null {
    return this.props.endDate;
  }
  get retentionPct(): number {
    return this.props.retentionPct;
  }
  get advancePct(): number {
    return this.props.advancePct;
  }
  get priceDiffOn(): boolean {
    return this.props.priceDiffOn;
  }
  get tender(): TenderInfoProps | null {
    return this.props.tender;
  }
  get createdBy(): number | null {
    return this.props.createdBy;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  update(changes: ContractUpdate, now: Date): Contract {
    const title = changes.title !== undefined ? changes.title.trim() : this.props.title;
    if (title.length === 0) throw new Error('Contract.title boş olamaz');
    const amount = changes.amount !== undefined ? changes.amount : this.props.amount;
    if (amount < 0) throw new Error('Contract.amount negatif olamaz');
    return new Contract({
      ...this.props,
      title,
      vendorId: changes.vendorId !== undefined ? changes.vendorId : this.props.vendorId,
      amount,
      currency: changes.currency ?? this.props.currency,
      signDate: changes.signDate !== undefined ? changes.signDate : this.props.signDate,
      startDate: changes.startDate !== undefined ? changes.startDate : this.props.startDate,
      endDate: changes.endDate !== undefined ? changes.endDate : this.props.endDate,
      retentionPct:
        changes.retentionPct !== undefined ? changes.retentionPct : this.props.retentionPct,
      advancePct: changes.advancePct !== undefined ? changes.advancePct : this.props.advancePct,
      priceDiffOn: changes.priceDiffOn !== undefined ? changes.priceDiffOn : this.props.priceDiffOn,
      tender: changes.tender !== undefined ? changes.tender : this.props.tender,
      updatedAt: now,
    });
  }

  toJSON(): Readonly<ContractProps> {
    return { ...this.props };
  }
}
