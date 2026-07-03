/**
 * Yeşil Defter (metraj) + Ataşman use-case'leri.
 *
 * - Yeşil defter: bir sözleşmenin keşif satırı için ölçülen metraj (kümülatif).
 *   Sözleşme ve keşif satırı varlığı doğrulanır.
 * - Ataşman: bir yeşil defter kaydına bağlı ölçü kalemi (boyut/formül → miktar).
 *   Ataşman eklenince/güncellenince/silinince ilgili yeşil defter kaydının
 *   measured_qty'si ataşman toplamına EŞİTLENİR (tek doğruluk kaynağı).
 * - Özet: keşif satırı bazında kümülatif metraj (hakediş this_qty beslemesi).
 */
import {
  AttachmentNotFoundError,
  ContractNotFoundError,
  ConstructionValidationError,
  MeasurementNotFoundError,
} from '../../domain/errors/ConstructionErrors.js';
import { Attachment, computeAttachmentQty } from '../../domain/entities/Attachment.js';
import { round3 } from '../../domain/valueObjects/Currency.js';
import {
  toAttachmentDto,
  toMeasurementDto,
  type AttachmentDto,
  type MeasurementDto,
  type MeasurementSummaryLineDto,
} from '../dto/MeasurementDtos.js';
import type { BoqRepository } from '../ports/BoqRepository.js';
import type { ContractRepository } from '../ports/ContractRepository.js';
import type {
  AttachmentRepository,
  MeasurementBookRepository,
} from '../ports/MeasurementRepositories.js';

// --- Yeşil Defter ----------------------------------------------------------

export interface CreateMeasurementInput {
  companyId: number;
  contractId: number;
  boqLineId: number;
  progressId?: number | null | undefined;
  measuredQty?: number | undefined;
  measuredAt?: string | null | undefined;
  note?: string | null | undefined;
  createdBy: number | null;
}

export class CreateMeasurementUseCase {
  constructor(
    private readonly measurements: MeasurementBookRepository,
    private readonly contracts: ContractRepository,
    private readonly boq: BoqRepository,
  ) {}

  async execute(input: CreateMeasurementInput): Promise<MeasurementDto> {
    const contract = await this.contracts.findById(input.contractId, input.companyId);
    if (!contract) throw new ContractNotFoundError(input.contractId);

    const lines = await this.boq.listLinesByContract(input.contractId, input.companyId);
    if (!lines.some((l) => l.id === input.boqLineId)) {
      throw new ConstructionValidationError(
        `Keşif satırı bu sözleşmeye ait değil: ${input.boqLineId}`,
      );
    }

    const m = await this.measurements.insert({
      companyId: input.companyId,
      contractId: input.contractId,
      boqLineId: input.boqLineId,
      progressId: input.progressId ?? null,
      measuredQty: round3(input.measuredQty ?? 0),
      measuredAt: input.measuredAt ?? null,
      note: input.note?.trim() || null,
      createdBy: input.createdBy,
    });
    return toMeasurementDto(m);
  }
}

export class ListMeasurementsUseCase {
  constructor(private readonly measurements: MeasurementBookRepository) {}

  async execute(input: { companyId: number; contractId: number }): Promise<MeasurementDto[]> {
    const list = await this.measurements.listByContract(input.contractId, input.companyId);
    return list.map(toMeasurementDto);
  }
}

export interface UpdateMeasurementInput {
  measurementId: number;
  companyId: number;
  progressId?: number | null | undefined;
  measuredQty?: number | undefined;
  measuredAt?: string | null | undefined;
  note?: string | null | undefined;
}

export class UpdateMeasurementUseCase {
  constructor(private readonly measurements: MeasurementBookRepository) {}

  async execute(input: UpdateMeasurementInput): Promise<MeasurementDto> {
    const m = await this.measurements.findById(input.measurementId, input.companyId);
    if (!m) throw new MeasurementNotFoundError(input.measurementId);
    const updated = m.update({
      ...(input.progressId !== undefined ? { progressId: input.progressId } : {}),
      ...(input.measuredQty !== undefined ? { measuredQty: round3(input.measuredQty) } : {}),
      ...(input.measuredAt !== undefined ? { measuredAt: input.measuredAt } : {}),
      ...(input.note !== undefined ? { note: input.note?.trim() || null } : {}),
    });
    await this.measurements.update(updated);
    return toMeasurementDto(updated);
  }
}

export class DeleteMeasurementUseCase {
  constructor(private readonly measurements: MeasurementBookRepository) {}

  async execute(input: { measurementId: number; companyId: number }): Promise<void> {
    const ok = await this.measurements.delete(input.measurementId, input.companyId);
    if (!ok) throw new MeasurementNotFoundError(input.measurementId);
  }
}

export class GetMeasurementSummaryUseCase {
  constructor(
    private readonly measurements: MeasurementBookRepository,
    private readonly contracts: ContractRepository,
  ) {}

  async execute(input: {
    companyId: number;
    contractId: number;
  }): Promise<MeasurementSummaryLineDto[]> {
    const contract = await this.contracts.findById(input.contractId, input.companyId);
    if (!contract) throw new ContractNotFoundError(input.contractId);
    const rows = await this.measurements.summaryByContract(input.contractId, input.companyId);
    return [...rows];
  }
}

// --- Ataşman ---------------------------------------------------------------

/** Ataşman değişince ilgili yeşil defter kaydının metrajını toplamla eşitler. */
async function syncMeasuredQty(
  measurements: MeasurementBookRepository,
  attachments: AttachmentRepository,
  measurementId: number,
  companyId: number,
): Promise<void> {
  const m = await measurements.findById(measurementId, companyId);
  if (!m) return;
  const total = round3(await attachments.sumByMeasurement(measurementId, companyId));
  await measurements.update(m.update({ measuredQty: total }));
}

export interface CreateAttachmentInput {
  companyId: number;
  measurementId: number;
  boqLineId?: number | null | undefined;
  formula?: string | null | undefined;
  dimA?: number | null | undefined;
  dimB?: number | null | undefined;
  dimC?: number | null | undefined;
  countN?: number | null | undefined;
  manualQty?: number | null | undefined;
  fileUrl?: string | null | undefined;
}

export class CreateAttachmentUseCase {
  constructor(
    private readonly attachments: AttachmentRepository,
    private readonly measurements: MeasurementBookRepository,
  ) {}

  async execute(input: CreateAttachmentInput): Promise<AttachmentDto> {
    const parent = await this.measurements.findById(input.measurementId, input.companyId);
    if (!parent) throw new MeasurementNotFoundError(input.measurementId);

    const resultQty = round3(
      computeAttachmentQty({
        dimA: input.dimA,
        dimB: input.dimB,
        dimC: input.dimC,
        countN: input.countN,
        manualQty: input.manualQty,
      }),
    );
    const a = await this.attachments.insert({
      companyId: input.companyId,
      measurementId: input.measurementId,
      boqLineId: input.boqLineId ?? parent.boqLineId,
      formula: input.formula?.trim() || null,
      dimA: input.dimA ?? null,
      dimB: input.dimB ?? null,
      dimC: input.dimC ?? null,
      countN: input.countN ?? null,
      resultQty,
      fileUrl: input.fileUrl?.trim() || null,
    });
    await syncMeasuredQty(
      this.measurements,
      this.attachments,
      input.measurementId,
      input.companyId,
    );
    return toAttachmentDto(a);
  }
}

export class ListAttachmentsUseCase {
  constructor(private readonly attachments: AttachmentRepository) {}

  async execute(input: { companyId: number; measurementId: number }): Promise<AttachmentDto[]> {
    const list = await this.attachments.listByMeasurement(input.measurementId, input.companyId);
    return list.map(toAttachmentDto);
  }
}

export interface UpdateAttachmentInput {
  attachmentId: number;
  companyId: number;
  boqLineId?: number | null | undefined;
  formula?: string | null | undefined;
  dimA?: number | null | undefined;
  dimB?: number | null | undefined;
  dimC?: number | null | undefined;
  countN?: number | null | undefined;
  manualQty?: number | null | undefined;
  fileUrl?: string | null | undefined;
}

export class UpdateAttachmentUseCase {
  constructor(
    private readonly attachments: AttachmentRepository,
    private readonly measurements: MeasurementBookRepository,
  ) {}

  async execute(input: UpdateAttachmentInput): Promise<AttachmentDto> {
    const existing = await this.attachments.findById(input.attachmentId, input.companyId);
    if (!existing) throw new AttachmentNotFoundError(input.attachmentId);

    // Verilen alanları mevcutla harmanla, sonra miktarı yeniden hesapla.
    const dimA = input.dimA !== undefined ? input.dimA : existing.dimA;
    const dimB = input.dimB !== undefined ? input.dimB : existing.dimB;
    const dimC = input.dimC !== undefined ? input.dimC : existing.dimC;
    const countN = input.countN !== undefined ? input.countN : existing.countN;
    const resultQty = round3(
      computeAttachmentQty({
        dimA,
        dimB,
        dimC,
        countN,
        manualQty: input.manualQty !== undefined ? input.manualQty : existing.resultQty,
      }),
    );
    const next = Attachment.create({
      id: existing.id,
      companyId: existing.companyId,
      measurementId: existing.measurementId,
      boqLineId: input.boqLineId !== undefined ? input.boqLineId : existing.boqLineId,
      formula: input.formula !== undefined ? input.formula?.trim() || null : existing.formula,
      dimA,
      dimB,
      dimC,
      countN,
      resultQty,
      fileUrl: input.fileUrl !== undefined ? input.fileUrl?.trim() || null : existing.fileUrl,
      createdAt: existing.createdAt,
    });
    await this.attachments.update(next);
    await syncMeasuredQty(
      this.measurements,
      this.attachments,
      existing.measurementId,
      input.companyId,
    );
    return toAttachmentDto(next);
  }
}

export class DeleteAttachmentUseCase {
  constructor(
    private readonly attachments: AttachmentRepository,
    private readonly measurements: MeasurementBookRepository,
  ) {}

  async execute(input: { attachmentId: number; companyId: number }): Promise<void> {
    const existing = await this.attachments.findById(input.attachmentId, input.companyId);
    if (!existing) throw new AttachmentNotFoundError(input.attachmentId);
    await this.attachments.delete(input.attachmentId, input.companyId);
    await syncMeasuredQty(
      this.measurements,
      this.attachments,
      existing.measurementId,
      input.companyId,
    );
  }
}
