/**
 * Taahhüt & EVM use-case'leri (FAZ 7).
 *
 * SENKRON UCU (SyncCommitmentsUseCase) köprünün construction tarafı: monolit
 * satınalmadan gelen sipariş satırları (source + refNo + refLineNo) anahtarıyla
 * idempotent upsert edilir. Aynı yük iki kez gönderilse sonuç değişmez —
 * senkronun "en az bir kez" teslim garantisiyle çalışabilmesinin şartı bu.
 *
 * Elle giriş (source='manual') ayrı uçtan: her taahhüt PO değildir (taşeron
 * anlaşması, kira, nakliye). Senkron kaynaklı kaydın parasal alanlarını elle
 * oynatmak SERBEST ama bir sonraki senkron kaynağın değerini geri yazar —
 * kaynak-of-truth monolittir (köprü kararı).
 */
import type {
  Commitment,
  CommitmentSource,
  CommitmentUpdate,
} from '../../domain/entities/Commitment.js';
import {
  CommitmentNotFoundError,
  ConstructionValidationError,
  ProjectNotFoundError,
} from '../../domain/errors/ConstructionErrors.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';
import type { Clock } from '../ports/Clock.js';
import type {
  CommitmentFilter,
  CommitmentRepository,
  ContractEvmRow,
  ProjectCommitmentSummaryRow,
} from '../ports/CommitmentRepository.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';

// ===== DTO ==================================================================

export interface CommitmentDto {
  id: number;
  companyId: number;
  projectId: number;
  contractId: number | null;
  boqLineId: number | null;
  locationId: number | null;
  source: string;
  refNo: string;
  refLineNo: number;
  vendorId: number | null;
  description: string;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  amount: number;
  deliveredAmount: number;
  /** Açık taahhüt = amount − delivered (kapalı/iptalde 0) — maruziyete giren kısım. */
  openAmount: number;
  currency: string;
  status: string;
  committedAt: string;
  closedAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toCommitmentDto(c: Commitment): CommitmentDto {
  const j = c.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    projectId: j.projectId,
    contractId: j.contractId,
    boqLineId: j.boqLineId,
    locationId: j.locationId,
    source: j.source,
    refNo: j.refNo,
    refLineNo: j.refLineNo,
    vendorId: j.vendorId,
    description: j.description,
    quantity: j.quantity,
    unit: j.unit,
    unitPrice: j.unitPrice,
    amount: j.amount,
    deliveredAmount: j.deliveredAmount,
    openAmount: c.openAmount,
    currency: j.currency,
    status: j.status,
    committedAt: j.committedAt,
    closedAt: j.closedAt === null ? null : j.closedAt.toISOString(),
    note: j.note,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}

// ===== USE-CASE'LER =========================================================

export interface CreateCommitmentInput {
  companyId: number;
  projectId: number;
  contractId?: number | null | undefined;
  boqLineId?: number | null | undefined;
  locationId?: number | null | undefined;
  source?: CommitmentSource | undefined;
  refNo: string;
  refLineNo?: number | undefined;
  vendorId?: number | null | undefined;
  description: string;
  quantity?: number | undefined;
  unit?: string | null | undefined;
  unitPrice?: number | undefined;
  amount: number;
  currency?: CurrencyCode | undefined;
  committedAt?: string | undefined;
  note?: string | null | undefined;
  createdBy?: number | null | undefined;
}

export class CreateCommitmentUseCase {
  constructor(
    private readonly commitments: CommitmentRepository,
    private readonly projects: ProjectRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateCommitmentInput): Promise<CommitmentDto> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);

    const created = await this.commitments.insert({
      companyId: input.companyId,
      projectId: input.projectId,
      contractId: input.contractId ?? null,
      boqLineId: input.boqLineId ?? null,
      locationId: input.locationId ?? null,
      source: input.source ?? 'manual',
      refNo: input.refNo.trim(),
      refLineNo: input.refLineNo ?? 1,
      vendorId: input.vendorId ?? null,
      description: input.description.trim(),
      quantity: input.quantity ?? 1,
      unit: input.unit?.trim() || null,
      unitPrice: input.unitPrice ?? 0,
      amount: input.amount,
      deliveredAmount: 0,
      currency: input.currency ?? 'TRY',
      committedAt: input.committedAt ?? this.clock.now().toISOString().slice(0, 10),
      note: input.note?.trim() || null,
      createdBy: input.createdBy ?? null,
    });
    return toCommitmentDto(created);
  }
}

export class UpdateCommitmentUseCase {
  constructor(
    private readonly commitments: CommitmentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: { commitmentId: number; companyId: number } & CommitmentUpdate,
  ): Promise<CommitmentDto> {
    const cmt = await this.commitments.findById(input.commitmentId, input.companyId);
    if (!cmt) throw new CommitmentNotFoundError(input.commitmentId);
    const { commitmentId: _i, companyId: _c, ...patch } = input;
    const updated = cmt.update(
      Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
      this.clock.now(),
    );
    return toCommitmentDto(await this.commitments.update(updated));
  }
}

export class RecordCommitmentDeliveryUseCase {
  constructor(
    private readonly commitments: CommitmentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    commitmentId: number;
    companyId: number;
    /** KÜMÜLATİF teslim tutarı (delta değil). */
    deliveredAmount: number;
  }): Promise<CommitmentDto> {
    const cmt = await this.commitments.findById(input.commitmentId, input.companyId);
    if (!cmt) throw new CommitmentNotFoundError(input.commitmentId);
    const updated = cmt.recordDelivery(input.deliveredAmount, this.clock.now());
    return toCommitmentDto(await this.commitments.update(updated));
  }
}

export class CloseCommitmentUseCase {
  constructor(
    private readonly commitments: CommitmentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: { commitmentId: number; companyId: number }): Promise<CommitmentDto> {
    const cmt = await this.commitments.findById(input.commitmentId, input.companyId);
    if (!cmt) throw new CommitmentNotFoundError(input.commitmentId);
    return toCommitmentDto(await this.commitments.update(cmt.close(this.clock.now())));
  }
}

export class CancelCommitmentUseCase {
  constructor(
    private readonly commitments: CommitmentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: { commitmentId: number; companyId: number }): Promise<CommitmentDto> {
    const cmt = await this.commitments.findById(input.commitmentId, input.companyId);
    if (!cmt) throw new CommitmentNotFoundError(input.commitmentId);
    return toCommitmentDto(await this.commitments.update(cmt.cancel(this.clock.now())));
  }
}

export class ListCommitmentsUseCase {
  constructor(private readonly commitments: CommitmentRepository) {}

  async execute(input: CommitmentFilter & { companyId: number }): Promise<CommitmentDto[]> {
    const { companyId, ...filter } = input;
    const rows = await this.commitments.list(companyId, filter);
    return rows.map(toCommitmentDto);
  }
}

// ===== SENKRON (köprünün construction tarafı) ===============================

export interface SyncCommitmentLine {
  refNo: string;
  refLineNo: number;
  projectId: number;
  contractId?: number | null | undefined;
  boqLineId?: number | null | undefined;
  locationId?: number | null | undefined;
  vendorId?: number | null | undefined;
  description: string;
  quantity?: number | undefined;
  unit?: string | null | undefined;
  unitPrice?: number | undefined;
  amount: number;
  /** KÜMÜLATİF teslim tutarı. */
  deliveredAmount?: number | undefined;
  currency?: CurrencyCode | undefined;
  committedAt?: string | undefined;
  /** true → kaynakta iptal edilmiş; burada da iptal edilir. */
  cancelled?: boolean | undefined;
}

export interface SyncCommitmentsResult {
  inserted: number;
  updated: number;
  cancelled: number;
  /** İşlenemeyen satırlar — senkron KISMEN başarılı olabilir, sessiz atlanmaz. */
  errors: { refNo: string; refLineNo: number; message: string }[];
}

export class SyncCommitmentsUseCase {
  constructor(
    private readonly commitments: CommitmentRepository,
    private readonly projects: ProjectRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    companyId: number;
    source: Exclude<CommitmentSource, 'manual'>;
    lines: ReadonlyArray<SyncCommitmentLine>;
    createdBy?: number | null | undefined;
  }): Promise<SyncCommitmentsResult> {
    if (input.lines.length === 0) {
      throw new ConstructionValidationError('senkron en az bir satır gerektirir');
    }
    const result: SyncCommitmentsResult = { inserted: 0, updated: 0, cancelled: 0, errors: [] };
    const now = this.clock.now();

    // Satır satır işlenir; bir satırın hatası diğerlerini DÜŞÜRMEZ. Senkron
    // toplu-transaction olsaydı tek bozuk satır bütün koşuyu geri alır ve
    // kaynakla projeksiyon süresiz ayrık kalırdı.
    for (const line of input.lines) {
      try {
        const existing = await this.commitments.findByRef(
          input.companyId,
          input.source,
          line.refNo,
          line.refLineNo,
        );

        if (existing === null) {
          const project = await this.projects.findById(line.projectId, input.companyId);
          if (!project) throw new ProjectNotFoundError(line.projectId);
          const created = await this.commitments.insert({
            companyId: input.companyId,
            projectId: line.projectId,
            contractId: line.contractId ?? null,
            boqLineId: line.boqLineId ?? null,
            locationId: line.locationId ?? null,
            source: input.source,
            refNo: line.refNo,
            refLineNo: line.refLineNo,
            vendorId: line.vendorId ?? null,
            description: line.description,
            quantity: line.quantity ?? 1,
            unit: line.unit ?? null,
            unitPrice: line.unitPrice ?? 0,
            amount: line.amount,
            deliveredAmount: 0,
            currency: line.currency ?? 'TRY',
            committedAt: line.committedAt ?? now.toISOString().slice(0, 10),
            note: null,
            createdBy: input.createdBy ?? null,
          });
          // Teslimat ayrı adım: entity kuralları (kümülatif, geriye gitmez) burada da geçerli.
          if ((line.deliveredAmount ?? 0) > 0) {
            await this.commitments.update(created.recordDelivery(line.deliveredAmount ?? 0, now));
          }
          if (line.cancelled === true) {
            const fresh = await this.commitments.findByRef(
              input.companyId,
              input.source,
              line.refNo,
              line.refLineNo,
            );
            if (fresh !== null && fresh.open) {
              await this.commitments.update(fresh.cancel(now));
              result.cancelled += 1;
            }
          }
          result.inserted += 1;
          continue;
        }

        if (line.cancelled === true) {
          if (existing.open) {
            await this.commitments.update(existing.cancel(now));
            result.cancelled += 1;
          }
          continue;
        }

        // Kaynak değerleri geri yazılır (kaynak-of-truth monolit). Teslimat
        // kümülatif geldiğinden update+recordDelivery sırası önemli: önce
        // tutar, sonra teslimat — tersine çevrilirse yeni tutar eski teslimatı
        // reddedebilir.
        let next = existing;
        if (existing.open) {
          next = existing.update(
            {
              ...(line.contractId !== undefined ? { contractId: line.contractId } : {}),
              ...(line.boqLineId !== undefined ? { boqLineId: line.boqLineId } : {}),
              ...(line.locationId !== undefined ? { locationId: line.locationId } : {}),
              ...(line.vendorId !== undefined ? { vendorId: line.vendorId } : {}),
              description: line.description,
              ...(line.quantity !== undefined ? { quantity: line.quantity } : {}),
              ...(line.unit !== undefined ? { unit: line.unit } : {}),
              ...(line.unitPrice !== undefined ? { unitPrice: line.unitPrice } : {}),
              amount: line.amount,
              ...(line.committedAt !== undefined ? { committedAt: line.committedAt } : {}),
            },
            now,
          );
        }
        if (line.deliveredAmount !== undefined) {
          next = next.recordDelivery(line.deliveredAmount, now);
        }
        await this.commitments.update(next);
        result.updated += 1;
      } catch (err) {
        result.errors.push({
          refNo: line.refNo,
          refLineNo: line.refLineNo,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return result;
  }
}

// ===== EVM ==================================================================

export class GetContractEvmUseCase {
  constructor(private readonly commitments: CommitmentRepository) {}

  async execute(input: { companyId: number; contractId: number }): Promise<ContractEvmRow | null> {
    return this.commitments.contractEvm(input.companyId, input.contractId);
  }
}

export class GetProjectEvmUseCase {
  constructor(private readonly commitments: CommitmentRepository) {}

  async execute(input: { companyId: number; projectId: number }): Promise<{
    contracts: ReadonlyArray<ContractEvmRow>;
    commitments: ProjectCommitmentSummaryRow | null;
  }> {
    const [contracts, commitments] = await Promise.all([
      this.commitments.projectEvm(input.companyId, input.projectId),
      this.commitments.projectSummary(input.companyId, input.projectId),
    ]);
    return { contracts, commitments };
  }
}
