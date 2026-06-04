/**
 * PayrollRun — bir şirketin belirli bir dönem (yıl/ay) bordro koşusu.
 *
 * Immutable. Davranış (finalize) yeni instance döner.
 * State machine PayrollRunStatus VO'da; draft → finalized.
 *
 * Finalize yan etkisi olarak finalizedByUserId / finalizedAt doldurulur.
 */
import {
  isPayrollRunTransitionAllowed,
  InvalidPayrollRunTransitionError,
  type PayrollRunStatus,
} from '../valueObjects/PayrollRunStatus.js';

export interface PayrollRunProps {
  id: number;
  companyId: number;
  periodYear: number;
  periodMonth: number;
  status: PayrollRunStatus;
  note: string | null;
  finalizedAt: Date | null;
  finalizedByUserId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export class PayrollRun {
  private constructor(private readonly props: Readonly<PayrollRunProps>) {}

  static create(props: PayrollRunProps): PayrollRun {
    if (props.id <= 0) {
      throw new Error('PayrollRun.id pozitif olmalı');
    }
    if (props.companyId <= 0) {
      throw new Error('PayrollRun.companyId pozitif olmalı');
    }
    if (!Number.isInteger(props.periodYear) || props.periodYear < 2000 || props.periodYear > 2200) {
      throw new Error('PayrollRun.periodYear 2000..2200 aralığında olmalı');
    }
    if (!Number.isInteger(props.periodMonth) || props.periodMonth < 1 || props.periodMonth > 12) {
      throw new Error('PayrollRun.periodMonth 1..12 aralığında olmalı');
    }
    if (props.finalizedByUserId !== null && props.finalizedByUserId <= 0) {
      throw new Error('PayrollRun.finalizedByUserId pozitif olmalı veya null');
    }
    if (props.status === 'finalized' && props.finalizedAt === null) {
      throw new Error('PayrollRun finalized ise finalizedAt dolu olmalı');
    }
    return new PayrollRun(props);
  }

  // ---------------------------------------------------------------------------
  // Getter'lar
  // ---------------------------------------------------------------------------
  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get periodYear(): number {
    return this.props.periodYear;
  }
  get periodMonth(): number {
    return this.props.periodMonth;
  }
  get status(): PayrollRunStatus {
    return this.props.status;
  }
  get note(): string | null {
    return this.props.note;
  }
  get finalizedAt(): Date | null {
    return this.props.finalizedAt;
  }
  get finalizedByUserId(): number | null {
    return this.props.finalizedByUserId;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isDraft(): boolean {
    return this.props.status === 'draft';
  }

  isFinalized(): boolean {
    return this.props.status === 'finalized';
  }

  // ---------------------------------------------------------------------------
  // Davranışlar — yeni instance döner
  // ---------------------------------------------------------------------------

  /** Koşuyu kesinleştir (draft → finalized). Yasaksa hata fırlatır. */
  finalize(now: Date, actorUserId: number | null): PayrollRun {
    if (!isPayrollRunTransitionAllowed(this.props.status, 'finalized')) {
      throw new InvalidPayrollRunTransitionError(this.props.status, 'finalized');
    }
    return new PayrollRun({
      ...this.props,
      status: 'finalized',
      finalizedAt: now,
      finalizedByUserId: actorUserId,
      updatedAt: now,
    });
  }

  toJSON(): Readonly<PayrollRunProps> {
    return { ...this.props };
  }
}
