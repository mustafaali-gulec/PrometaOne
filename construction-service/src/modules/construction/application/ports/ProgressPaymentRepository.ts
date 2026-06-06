/**
 * ProgressPaymentRepository — hakediş kalıcılık portu.
 * Concrete: infrastructure/persistence/PgProgressPaymentRepository.ts
 */
import type { ProgressPayment } from '../../domain/entities/ProgressPayment.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';
import type { DeductionKind } from '../../domain/valueObjects/Deduction.js';
import type {
  ProgressKind,
  ProgressStatus,
  ProgressType,
} from '../../domain/valueObjects/ProgressStatus.js';

export interface NewProgressLineInput {
  boqLineId: number;
  prevQty: number;
  thisQty: number;
  cumulQty: number;
  unitPrice: number;
  thisAmount: number;
  cumulAmount: number;
}

export interface HeaderTotals {
  grossThis: number;
  grossCumul: number;
  priceDiff: number;
  deductionsTot: number;
  netPayable: number;
}

export interface NewProgressInput {
  companyId: number;
  contractId: number;
  hakedisNo: string;
  kind: ProgressKind;
  ptype: ProgressType;
  seqNo: number;
  periodStart: string | null;
  periodEnd: string | null;
  currency: CurrencyCode;
  createdBy: number | null;
  totals: HeaderTotals;
  lines: ReadonlyArray<NewProgressLineInput>;
}

export interface NewDeductionInput {
  kind: DeductionKind;
  label: string | null;
  ratePct: number | null;
  amount: number;
  sign: number;
}

export interface BoqLineCumulative {
  boqLineId: number;
  qty: number;
}

export interface StatusChange {
  toStatus: ProgressStatus;
  fromStatus: ProgressStatus;
  submittedAt: Date | null;
  approvedAt: Date | null;
  approvedBy: number | null;
  actorUserId: number | null;
  note: string | null;
}

export interface ProgressPaymentRepository {
  insert(input: NewProgressInput): Promise<ProgressPayment>;
  findById(id: number, companyId: number): Promise<ProgressPayment | null>;
  listByContract(
    contractId: number,
    companyId: number,
    kind?: ProgressKind,
  ): Promise<ReadonlyArray<ProgressPayment>>;
  countByContractKind(contractId: number, companyId: number, kind: ProgressKind): Promise<number>;
  /** kind bazında onaylanmış/ödenmiş hakedişlerde her BoQ kalemi için Σ this_qty. */
  sumApprovedQtyByBoqLine(
    contractId: number,
    companyId: number,
    kind: ProgressKind,
  ): Promise<ReadonlyArray<BoqLineCumulative>>;
  saveLines(
    progressId: number,
    companyId: number,
    lines: ReadonlyArray<NewProgressLineInput>,
    totals: HeaderTotals,
  ): Promise<ProgressPayment>;
  saveDeductions(
    progressId: number,
    companyId: number,
    deductions: ReadonlyArray<NewDeductionInput>,
    totals: HeaderTotals,
  ): Promise<ProgressPayment>;
  changeStatus(
    progressId: number,
    companyId: number,
    change: StatusChange,
  ): Promise<ProgressPayment>;
}
