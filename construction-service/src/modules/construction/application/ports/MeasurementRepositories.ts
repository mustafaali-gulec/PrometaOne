/**
 * Yeşil Defter (metraj) + Ataşman kalıcılık portları.
 * Concrete: infrastructure/persistence/PgMeasurementRepositories.ts
 *
 * Tümü company_id ile scope'lanır (multi-tenant). Ataşman değişince ilgili
 * yeşil defter kaydının measured_qty'si ataşman toplamına eşitlenir (use-case).
 */
import type { Attachment } from '../../domain/entities/Attachment.js';
import type { MeasurementBook } from '../../domain/entities/MeasurementBook.js';
import type { MeasurementSummaryLineDto } from '../dto/MeasurementDtos.js';

export interface NewMeasurementInput {
  companyId: number;
  contractId: number;
  boqLineId: number;
  progressId: number | null;
  measuredQty: number;
  measuredAt: string | null;
  note: string | null;
  createdBy: number | null;
}

export interface MeasurementBookRepository {
  insert(input: NewMeasurementInput): Promise<MeasurementBook>;
  update(measurement: MeasurementBook): Promise<void>;
  delete(id: number, companyId: number): Promise<boolean>;
  findById(id: number, companyId: number): Promise<MeasurementBook | null>;
  listByContract(contractId: number, companyId: number): Promise<ReadonlyArray<MeasurementBook>>;
  /** Keşif satırı bazında kümülatif ölçülen metraj (hakediş beslemesi). */
  summaryByContract(
    contractId: number,
    companyId: number,
  ): Promise<ReadonlyArray<MeasurementSummaryLineDto>>;
}

export interface NewAttachmentInput {
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
}

export interface AttachmentRepository {
  insert(input: NewAttachmentInput): Promise<Attachment>;
  update(attachment: Attachment): Promise<void>;
  delete(id: number, companyId: number): Promise<boolean>;
  findById(id: number, companyId: number): Promise<Attachment | null>;
  listByMeasurement(measurementId: number, companyId: number): Promise<ReadonlyArray<Attachment>>;
  /** Bir yeşil defter kaydına bağlı ataşmanların result_qty toplamı. */
  sumByMeasurement(measurementId: number, companyId: number): Promise<number>;
}
