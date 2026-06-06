/**
 * BoqLine — Keşif satırı (iş kalemi). Tablo: cs_boq_lines (024_cs_boq.sql).
 *
 * amount ve pursantajPct türetilmiş alanlardır (uygulamada hesaplanır, denetim
 * için saklanır). Satırlar sözleşme bazında toplu yazılır (bulk replace), bu
 * yüzden entity mutator içermez — salt okunur değer nesnesi gibidir.
 */
export interface BoqLineProps {
  id: number;
  companyId: number;
  contractId: number;
  groupId: number | null;
  pozId: number | null;
  lineNo: number;
  pozNo: string | null;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  pursantajPct: number;
  createdAt: Date;
  updatedAt: Date;
}

export class BoqLine {
  private constructor(private readonly props: Readonly<BoqLineProps>) {}

  static create(props: BoqLineProps): BoqLine {
    if (props.id <= 0) throw new Error('BoqLine.id pozitif olmalı');
    if (props.contractId <= 0) throw new Error('BoqLine.contractId pozitif olmalı');
    if (props.description.trim().length === 0) throw new Error('BoqLine.description boş olamaz');
    if (props.quantity < 0) throw new Error('BoqLine.quantity negatif olamaz');
    if (props.unitPrice < 0) throw new Error('BoqLine.unitPrice negatif olamaz');
    return new BoqLine(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get contractId(): number {
    return this.props.contractId;
  }
  get groupId(): number | null {
    return this.props.groupId;
  }
  get pozId(): number | null {
    return this.props.pozId;
  }
  get lineNo(): number {
    return this.props.lineNo;
  }
  get pozNo(): string | null {
    return this.props.pozNo;
  }
  get description(): string {
    return this.props.description;
  }
  get unit(): string {
    return this.props.unit;
  }
  get quantity(): number {
    return this.props.quantity;
  }
  get unitPrice(): number {
    return this.props.unitPrice;
  }
  get amount(): number {
    return this.props.amount;
  }
  get pursantajPct(): number {
    return this.props.pursantajPct;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toJSON(): Readonly<BoqLineProps> {
    return { ...this.props };
  }
}
