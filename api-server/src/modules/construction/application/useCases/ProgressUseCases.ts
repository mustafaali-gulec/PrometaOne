/**
 * Hakediş use-case'leri.
 *
 * Create: sözleşmenin keşif (BoQ) satırlarından hakediş satırlarını tohumlar;
 *   prevQty = aynı kind'te onaylı/ödenmiş hakedişlerin Σ this_qty'si. seqNo
 *   kind bazında artar, hakedisNo = HAK-YYYY-NNNN.
 * SaveLines: bu dönem miktarları girilir → tutar/kümülatif/toplam yeniden hesap.
 * SaveDeductions: kesinti/ilave + fiyat farkı → net yeniden hesap.
 * ChangeStatus: durum makinesi + onay audit (status history).
 * Satır/kesinti yalnızca taslak/reddedilmiş hakedişte düzenlenebilir.
 */
import {
  ConstructionValidationError,
  ContractNotFoundError,
  ProgressNotFoundError,
} from '../../domain/errors/ConstructionErrors.js';
import { round2 } from '../../domain/valueObjects/Currency.js';
import { defaultSignFor, type DeductionKind } from '../../domain/valueObjects/Deduction.js';
import {
  computeLineFigures,
  computeProgressTotals,
} from '../../domain/valueObjects/ProgressCalc.js';
import type {
  ProgressKind,
  ProgressStatus,
  ProgressType,
} from '../../domain/valueObjects/ProgressStatus.js';
import {
  toProgressPaymentDto,
  toProgressSummaryDto,
  type ProgressPaymentDto,
  type ProgressPaymentSummaryDto,
} from '../dto/ProgressDtos.js';
import type { BoqRepository } from '../ports/BoqRepository.js';
import type { Clock } from '../ports/Clock.js';
import type { ContractRepository } from '../ports/ContractRepository.js';
import type {
  NewDeductionInput,
  NewProgressLineInput,
  ProgressPaymentRepository,
} from '../ports/ProgressPaymentRepository.js';

export interface CreateProgressInput {
  companyId: number;
  contractId: number;
  kind: ProgressKind;
  ptype?: ProgressType | undefined;
  periodStart?: string | null | undefined;
  periodEnd?: string | null | undefined;
  createdBy?: number | null | undefined;
}

export class CreateProgressPaymentUseCase {
  constructor(
    private readonly progress: ProgressPaymentRepository,
    private readonly contracts: ContractRepository,
    private readonly boq: BoqRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateProgressInput): Promise<ProgressPaymentDto> {
    const contract = await this.contracts.findById(input.contractId, input.companyId);
    if (!contract) throw new ContractNotFoundError(input.contractId);

    const boqLines = await this.boq.listLinesByContract(input.contractId, input.companyId);
    if (boqLines.length === 0) {
      throw new ConstructionValidationError('Hakediş için önce keşif (BoQ) girilmeli');
    }

    const cumulatives = await this.progress.sumApprovedQtyByBoqLine(
      input.contractId,
      input.companyId,
      input.kind,
    );
    const prevByBoq = new Map<number, number>();
    for (const c of cumulatives) prevByBoq.set(c.boqLineId, c.qty);

    const seqNo =
      (await this.progress.countByContractKind(input.contractId, input.companyId, input.kind)) + 1;
    const year = this.clock.now().getFullYear();
    const hakedisNo = `HAK-${String(year)}-${String(seqNo).padStart(4, '0')}`;

    const lines: NewProgressLineInput[] = boqLines.map((bl) => {
      const prevQty = prevByBoq.get(bl.id) ?? 0;
      const fig = computeLineFigures(prevQty, 0, bl.unitPrice);
      return {
        boqLineId: bl.id,
        prevQty,
        thisQty: 0,
        cumulQty: fig.cumulQty,
        unitPrice: bl.unitPrice,
        thisAmount: fig.thisAmount,
        cumulAmount: fig.cumulAmount,
      };
    });

    const totals = computeProgressTotals({
      thisAmounts: lines.map((l) => l.thisAmount),
      cumulAmounts: lines.map((l) => l.cumulAmount),
      priceDiff: 0,
      deductions: [],
    });

    const created = await this.progress.insert({
      companyId: input.companyId,
      contractId: input.contractId,
      hakedisNo,
      kind: input.kind,
      ptype: input.ptype ?? 'interim',
      seqNo,
      periodStart: input.periodStart ?? null,
      periodEnd: input.periodEnd ?? null,
      currency: contract.currency,
      createdBy: input.createdBy ?? null,
      totals: { ...totals, priceDiff: 0 },
      lines,
    });
    return toProgressPaymentDto(created);
  }
}

export interface GetProgressInput {
  companyId: number;
  progressId: number;
}

export class GetProgressPaymentUseCase {
  constructor(private readonly progress: ProgressPaymentRepository) {}

  async execute(input: GetProgressInput): Promise<ProgressPaymentDto> {
    const p = await this.progress.findById(input.progressId, input.companyId);
    if (!p) throw new ProgressNotFoundError(input.progressId);
    return toProgressPaymentDto(p);
  }
}

export interface ListProgressInput {
  companyId: number;
  contractId: number;
  kind?: ProgressKind;
}

export class ListProgressPaymentsUseCase {
  constructor(private readonly progress: ProgressPaymentRepository) {}

  async execute(input: ListProgressInput): Promise<ProgressPaymentSummaryDto[]> {
    const list = await this.progress.listByContract(input.contractId, input.companyId, input.kind);
    return list.map(toProgressSummaryDto);
  }
}

export interface SaveProgressLinesInput {
  companyId: number;
  progressId: number;
  /** boqLineId → bu dönem miktarı. Listede olmayan satırlar değişmez. */
  quantities: ReadonlyArray<{ boqLineId: number; thisQty: number }>;
}

export class SaveProgressLinesUseCase {
  constructor(private readonly progress: ProgressPaymentRepository) {}

  async execute(input: SaveProgressLinesInput): Promise<ProgressPaymentDto> {
    const p = await this.progress.findById(input.progressId, input.companyId);
    if (!p) throw new ProgressNotFoundError(input.progressId);
    p.assertEditable();

    const thisByBoq = new Map<number, number>();
    for (const q of input.quantities) thisByBoq.set(q.boqLineId, q.thisQty);

    const lines: NewProgressLineInput[] = p.lines.map((l) => {
      const thisQty = thisByBoq.has(l.boqLineId) ? thisByBoq.get(l.boqLineId)! : l.thisQty;
      const fig = computeLineFigures(l.prevQty, thisQty, l.unitPrice);
      return {
        boqLineId: l.boqLineId,
        prevQty: l.prevQty,
        thisQty,
        cumulQty: fig.cumulQty,
        unitPrice: l.unitPrice,
        thisAmount: fig.thisAmount,
        cumulAmount: fig.cumulAmount,
      };
    });

    const totals = computeProgressTotals({
      thisAmounts: lines.map((l) => l.thisAmount),
      cumulAmounts: lines.map((l) => l.cumulAmount),
      priceDiff: p.priceDiff,
      deductions: p.deductions.map((d) => ({ sign: d.sign, amount: d.amount })),
    });

    const saved = await this.progress.saveLines(input.progressId, input.companyId, lines, {
      ...totals,
      priceDiff: p.priceDiff,
    });
    return toProgressPaymentDto(saved);
  }
}

export interface DeductionInput {
  kind: DeductionKind;
  label?: string | null | undefined;
  ratePct?: number | null | undefined;
  amount: number;
  sign?: number | undefined;
}

export interface SaveDeductionsInput {
  companyId: number;
  progressId: number;
  priceDiff?: number | undefined;
  deductions: ReadonlyArray<DeductionInput>;
}

export class SaveDeductionsUseCase {
  constructor(private readonly progress: ProgressPaymentRepository) {}

  async execute(input: SaveDeductionsInput): Promise<ProgressPaymentDto> {
    const p = await this.progress.findById(input.progressId, input.companyId);
    if (!p) throw new ProgressNotFoundError(input.progressId);
    p.assertEditable();

    const priceDiff = input.priceDiff !== undefined ? round2(input.priceDiff) : p.priceDiff;
    const deductions: NewDeductionInput[] = input.deductions.map((d) => ({
      kind: d.kind,
      label: d.label ?? null,
      ratePct: d.ratePct ?? null,
      amount: round2(d.amount),
      sign: d.sign ?? defaultSignFor(d.kind),
    }));

    const totals = computeProgressTotals({
      thisAmounts: p.lines.map((l) => l.thisAmount),
      cumulAmounts: p.lines.map((l) => l.cumulAmount),
      priceDiff,
      deductions: deductions.map((d) => ({ sign: d.sign, amount: d.amount })),
    });

    const saved = await this.progress.saveDeductions(
      input.progressId,
      input.companyId,
      deductions,
      {
        ...totals,
        priceDiff,
      },
    );
    return toProgressPaymentDto(saved);
  }
}

export interface ChangeProgressStatusInput {
  companyId: number;
  progressId: number;
  status: ProgressStatus;
  note?: string | null | undefined;
  actorUserId?: number | null | undefined;
}

export class ChangeProgressStatusUseCase {
  constructor(
    private readonly progress: ProgressPaymentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: ChangeProgressStatusInput): Promise<ProgressPaymentDto> {
    const p = await this.progress.findById(input.progressId, input.companyId);
    if (!p) throw new ProgressNotFoundError(input.progressId);

    const fromStatus = p.status;
    const actorUserId = input.actorUserId ?? null;
    const updated = p.changeStatus(input.status, this.clock.now(), actorUserId);
    const j = updated.toJSON();

    const saved = await this.progress.changeStatus(input.progressId, input.companyId, {
      toStatus: j.status,
      fromStatus,
      submittedAt: j.submittedAt,
      approvedAt: j.approvedAt,
      approvedBy: j.approvedBy,
      actorUserId,
      note: input.note ?? null,
    });
    return toProgressPaymentDto(saved);
  }
}
