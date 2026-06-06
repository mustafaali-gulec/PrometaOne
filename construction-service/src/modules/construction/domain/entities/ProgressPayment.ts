/**
 * ProgressPayment — Hakediş aggregate (başlık + satırlar + kesintiler).
 * Tablolar: cs_progress_payments (+ cs_progress_lines, cs_progress_deductions).
 *
 * Toplamlar (grossThis/netPayable …) use-case'te ProgressCalc ile hesaplanıp
 * başlığa yazılır; entity durum geçişini (changeStatus) ve düzenlenebilirlik
 * invariant'ını korur. Immutable.
 */
import {
  ProgressNotEditableError,
  InvalidStatusTransitionError,
} from '../errors/ConstructionErrors.js';
import type { CurrencyCode } from '../valueObjects/Currency.js';
import type { DeductionKind } from '../valueObjects/Deduction.js';
import {
  canTransitionProgress,
  isEditableStatus,
  type ProgressKind,
  type ProgressStatus,
  type ProgressType,
} from '../valueObjects/ProgressStatus.js';

export interface ProgressLineData {
  id: number;
  boqLineId: number;
  prevQty: number;
  thisQty: number;
  cumulQty: number;
  unitPrice: number;
  thisAmount: number;
  cumulAmount: number;
}

export interface DeductionData {
  id: number;
  kind: DeductionKind;
  label: string | null;
  ratePct: number | null;
  amount: number;
  sign: number;
}

export interface ProgressPaymentProps {
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
  submittedAt: Date | null;
  approvedAt: Date | null;
  approvedBy: number | null;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
  lines: ReadonlyArray<ProgressLineData>;
  deductions: ReadonlyArray<DeductionData>;
}

export class ProgressPayment {
  private constructor(private readonly props: Readonly<ProgressPaymentProps>) {}

  static create(props: ProgressPaymentProps): ProgressPayment {
    if (props.id <= 0) throw new Error('ProgressPayment.id pozitif olmalı');
    if (props.contractId <= 0) throw new Error('ProgressPayment.contractId pozitif olmalı');
    if (props.hakedisNo.trim().length === 0)
      throw new Error('ProgressPayment.hakedisNo boş olamaz');
    if (props.seqNo <= 0) throw new Error('ProgressPayment.seqNo pozitif olmalı');
    return new ProgressPayment(props);
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
  get hakedisNo(): string {
    return this.props.hakedisNo;
  }
  get kind(): ProgressKind {
    return this.props.kind;
  }
  get ptype(): ProgressType {
    return this.props.ptype;
  }
  get seqNo(): number {
    return this.props.seqNo;
  }
  get status(): ProgressStatus {
    return this.props.status;
  }
  get priceDiff(): number {
    return this.props.priceDiff;
  }
  get currency(): CurrencyCode {
    return this.props.currency;
  }
  get lines(): ReadonlyArray<ProgressLineData> {
    return this.props.lines;
  }
  get deductions(): ReadonlyArray<DeductionData> {
    return this.props.deductions;
  }

  /** Satır/kesinti düzenlemesi için durum uygun mu — değilse fırlatır. */
  assertEditable(): void {
    if (!isEditableStatus(this.props.status)) {
      throw new ProgressNotEditableError(this.props.status);
    }
  }

  changeStatus(to: ProgressStatus, now: Date, actorUserId: number | null): ProgressPayment {
    if (!canTransitionProgress(this.props.status, to)) {
      throw new InvalidStatusTransitionError(this.props.status, to);
    }
    const next: ProgressPaymentProps = { ...this.props, status: to, updatedAt: now };
    if (to === 'submitted') next.submittedAt = now;
    if (to === 'approved') {
      next.approvedAt = now;
      next.approvedBy = actorUserId;
    }
    if (to === 'rejected') {
      next.approvedAt = null;
      next.approvedBy = null;
    }
    return new ProgressPayment(next);
  }

  toJSON(): Readonly<ProgressPaymentProps> {
    return { ...this.props };
  }
}
