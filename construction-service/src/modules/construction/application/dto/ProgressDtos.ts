/**
 * Hakediş DTO'ları — başlık + satırlar + kesintiler.
 */
import type { ProgressPayment } from '../../domain/entities/ProgressPayment.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';
import type { DeductionKind } from '../../domain/valueObjects/Deduction.js';
import type {
  ProgressKind,
  ProgressStatus,
  ProgressType,
} from '../../domain/valueObjects/ProgressStatus.js';

export interface ProgressLineDto {
  id: number;
  boqLineId: number;
  prevQty: number;
  thisQty: number;
  cumulQty: number;
  unitPrice: number;
  thisAmount: number;
  cumulAmount: number;
}

export interface DeductionDto {
  id: number;
  kind: DeductionKind;
  label: string | null;
  ratePct: number | null;
  amount: number;
  sign: number;
}

export interface ProgressPaymentDto {
  id: number;
  companyId: number;
  contractId: number;
  hakedisNo: string;
  kind: ProgressKind;
  ptype: ProgressType;
  seqNo: number;
  periodStart: string | null;
  periodEnd: string | null;
  status: ProgressStatus;
  grossThis: number;
  grossCumul: number;
  priceDiff: number;
  deductionsTot: number;
  netPayable: number;
  currency: CurrencyCode;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedBy: number | null;
  createdAt: string;
  updatedAt: string;
  lines: ProgressLineDto[];
  deductions: DeductionDto[];
}

/** Liste için hafif özet (satır/kesinti içermez). */
export type ProgressPaymentSummaryDto = Omit<ProgressPaymentDto, 'lines' | 'deductions'>;

export function toProgressPaymentDto(p: ProgressPayment): ProgressPaymentDto {
  const j = p.toJSON();
  return {
    id: j.id,
    companyId: j.companyId,
    contractId: j.contractId,
    hakedisNo: j.hakedisNo,
    kind: j.kind,
    ptype: j.ptype,
    seqNo: j.seqNo,
    periodStart: j.periodStart,
    periodEnd: j.periodEnd,
    status: j.status,
    grossThis: j.grossThis,
    grossCumul: j.grossCumul,
    priceDiff: j.priceDiff,
    deductionsTot: j.deductionsTot,
    netPayable: j.netPayable,
    currency: j.currency,
    submittedAt: j.submittedAt ? j.submittedAt.toISOString() : null,
    approvedAt: j.approvedAt ? j.approvedAt.toISOString() : null,
    approvedBy: j.approvedBy,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
    lines: j.lines.map((l) => ({ ...l })),
    deductions: j.deductions.map((d) => ({ ...d })),
  };
}

export function toProgressSummaryDto(p: ProgressPayment): ProgressPaymentSummaryDto {
  const { lines: _lines, deductions: _deductions, ...rest } = toProgressPaymentDto(p);
  return rest;
}
