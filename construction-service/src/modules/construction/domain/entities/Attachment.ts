/**
 * Attachment — Ataşman (ölçü-detayı). Tablo: cs_attachments (001_construction_schema.sql).
 * Bir yeşil defter kaydına (measurementId) bağlı ölçü kalemi: formül ve/veya
 * boyutlar (dimA×dimB×dimC×countN) → resultQty; opsiyonel dosya eki (fileUrl).
 * resultQty use-case katmanında computeAttachmentQty ile hesaplanır. Immutable.
 */
export interface AttachmentProps {
  id: number;
  companyId: number;
  measurementId: number;
  boqLineId: number | null;
  formula: string | null;
  dimA: number | null;
  dimB: number | null;
  dimC: number | null;
  countN: number | null;
  resultQty: number;
  fileUrl: string | null;
  createdAt: Date;
}

export class Attachment {
  private constructor(private readonly props: Readonly<AttachmentProps>) {}

  static create(props: AttachmentProps): Attachment {
    if (props.id <= 0) throw new Error('Attachment.id pozitif olmalı');
    if (props.measurementId <= 0) throw new Error('Attachment.measurementId pozitif olmalı');
    if (props.resultQty < 0) throw new Error('Attachment.resultQty negatif olamaz');
    return new Attachment(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get measurementId(): number {
    return this.props.measurementId;
  }
  get boqLineId(): number | null {
    return this.props.boqLineId;
  }
  get formula(): string | null {
    return this.props.formula;
  }
  get dimA(): number | null {
    return this.props.dimA;
  }
  get dimB(): number | null {
    return this.props.dimB;
  }
  get dimC(): number | null {
    return this.props.dimC;
  }
  get countN(): number | null {
    return this.props.countN;
  }
  get resultQty(): number {
    return this.props.resultQty;
  }
  get fileUrl(): string | null {
    return this.props.fileUrl;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  toJSON(): Readonly<AttachmentProps> {
    return { ...this.props };
  }
}

/**
 * Ataşman miktarı: en az bir boyut verilmişse boyutların çarpımı × adet
 * (verilmeyen boyut 1 kabul edilir); hiç boyut yoksa elle girilen manualQty
 * (ölçü listesinden gelen doğrudan miktar). Sonuç 3 ondalığa yuvarlanır (repo/UC).
 */
export function computeAttachmentQty(input: {
  dimA?: number | null | undefined;
  dimB?: number | null | undefined;
  dimC?: number | null | undefined;
  countN?: number | null | undefined;
  manualQty?: number | null | undefined;
}): number {
  const hasDim = input.dimA != null || input.dimB != null || input.dimC != null;
  if (!hasDim) return Math.max(0, input.manualQty ?? 0);
  const a = input.dimA ?? 1;
  const b = input.dimB ?? 1;
  const c = input.dimC ?? 1;
  const n = input.countN ?? 1;
  return Math.max(0, a * b * c * n);
}
