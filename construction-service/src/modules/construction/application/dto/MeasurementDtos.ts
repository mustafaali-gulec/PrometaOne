/**
 * Yeşil Defter (metraj) + Ataşman DTO'ları + kümülatif özet.
 */
import type { Attachment } from '../../domain/entities/Attachment.js';
import type { MeasurementBook } from '../../domain/entities/MeasurementBook.js';

export interface MeasurementDto {
  id: number;
  companyId: number;
  contractId: number;
  boqLineId: number;
  progressId: number | null;
  measuredQty: number;
  measuredAt: string | null;
  note: string | null;
  createdAt: string;
}

export interface AttachmentDto {
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
  createdAt: string;
}

/** Bir keşif satırı için kümülatif ölçülen metraj (hakediş this_qty beslemesi). */
export interface MeasurementSummaryLineDto {
  boqLineId: number;
  totalMeasured: number;
}

export function toMeasurementDto(m: MeasurementBook): MeasurementDto {
  const p = m.toJSON();
  return {
    id: p.id,
    companyId: p.companyId,
    contractId: p.contractId,
    boqLineId: p.boqLineId,
    progressId: p.progressId,
    measuredQty: p.measuredQty,
    measuredAt: p.measuredAt,
    note: p.note,
    createdAt: p.createdAt.toISOString(),
  };
}

export function toAttachmentDto(a: Attachment): AttachmentDto {
  const p = a.toJSON();
  return {
    id: p.id,
    companyId: p.companyId,
    measurementId: p.measurementId,
    boqLineId: p.boqLineId,
    formula: p.formula,
    dimA: p.dimA,
    dimB: p.dimB,
    dimC: p.dimC,
    countN: p.countN,
    resultQty: p.resultQty,
    fileUrl: p.fileUrl,
    createdAt: p.createdAt.toISOString(),
  };
}
