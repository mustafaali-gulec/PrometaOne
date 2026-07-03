/**
 * MeasurementBook — Yeşil Defter kaydı (kümülatif metraj). Tablo: cs_measurement_book
 * (001_construction_schema.sql). Bir sözleşmenin bir keşif (BoQ) satırı için dönem
 * dönem ölçülen miktarı tutar; measured_qty ataşmanların toplamı ile beslenir ya da
 * elle girilir. Immutable.
 */
export interface MeasurementBookProps {
  id: number;
  companyId: number;
  contractId: number;
  boqLineId: number;
  progressId: number | null;
  measuredQty: number;
  measuredAt: string | null;
  note: string | null;
  createdBy: number | null;
  createdAt: Date;
}

export interface MeasurementBookUpdate {
  progressId?: number | null;
  measuredQty?: number;
  measuredAt?: string | null;
  note?: string | null;
}

export class MeasurementBook {
  private constructor(private readonly props: Readonly<MeasurementBookProps>) {}

  static create(props: MeasurementBookProps): MeasurementBook {
    if (props.id <= 0) throw new Error('MeasurementBook.id pozitif olmalı');
    if (props.contractId <= 0) throw new Error('MeasurementBook.contractId pozitif olmalı');
    if (props.boqLineId <= 0) throw new Error('MeasurementBook.boqLineId pozitif olmalı');
    if (props.measuredQty < 0) throw new Error('MeasurementBook.measuredQty negatif olamaz');
    return new MeasurementBook(props);
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
  get boqLineId(): number {
    return this.props.boqLineId;
  }
  get progressId(): number | null {
    return this.props.progressId;
  }
  get measuredQty(): number {
    return this.props.measuredQty;
  }
  get measuredAt(): string | null {
    return this.props.measuredAt;
  }
  get note(): string | null {
    return this.props.note;
  }
  get createdBy(): number | null {
    return this.props.createdBy;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  update(c: MeasurementBookUpdate): MeasurementBook {
    const measuredQty = c.measuredQty !== undefined ? c.measuredQty : this.props.measuredQty;
    if (measuredQty < 0) throw new Error('MeasurementBook.measuredQty negatif olamaz');
    return new MeasurementBook({
      ...this.props,
      progressId: c.progressId !== undefined ? c.progressId : this.props.progressId,
      measuredQty,
      measuredAt: c.measuredAt !== undefined ? c.measuredAt : this.props.measuredAt,
      note: c.note !== undefined ? c.note : this.props.note,
    });
  }

  toJSON(): Readonly<MeasurementBookProps> {
    return { ...this.props };
  }
}
