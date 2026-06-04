/**
 * LeaveRequest — bir çalışanın izin talebi.
 *
 * Immutable. Davranışlar (approve, reject, cancel) yeni instance döner.
 * State machine LeaveStatus VO'da; geçişler approve/reject/cancel ile yapılır.
 *
 * Onay/red yan etkisi olarak decidedByUserId / decidedAt / decisionNote
 * doldurulur (audit izi için denormalize).
 */
import {
  isLeaveTransitionAllowed,
  InvalidLeaveTransitionError,
  type LeaveStatus,
} from '../valueObjects/LeaveStatus.js';
import type { LeaveType } from '../valueObjects/LeaveType.js';

export interface LeaveRequestProps {
  id: number;
  companyId: number;
  employeeId: number;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  days: number;
  reason: string | null;
  status: LeaveStatus;
  requestedByUserId: number | null;
  decidedByUserId: number | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class LeaveRequest {
  private constructor(private readonly props: Readonly<LeaveRequestProps>) {}

  static create(props: LeaveRequestProps): LeaveRequest {
    if (props.id <= 0) {
      throw new Error('LeaveRequest.id pozitif olmalı');
    }
    if (props.companyId <= 0) {
      throw new Error('LeaveRequest.companyId pozitif olmalı');
    }
    if (props.employeeId <= 0) {
      throw new Error('LeaveRequest.employeeId pozitif olmalı');
    }
    if (props.days <= 0) {
      throw new Error('LeaveRequest.days pozitif olmalı');
    }
    if (props.endDate.getTime() < props.startDate.getTime()) {
      throw new Error('LeaveRequest.endDate startDate öncesi olamaz');
    }
    if (props.requestedByUserId !== null && props.requestedByUserId <= 0) {
      throw new Error('LeaveRequest.requestedByUserId pozitif olmalı veya null');
    }
    if (props.decidedByUserId !== null && props.decidedByUserId <= 0) {
      throw new Error('LeaveRequest.decidedByUserId pozitif olmalı veya null');
    }
    return new LeaveRequest(props);
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
  get employeeId(): number {
    return this.props.employeeId;
  }
  get leaveType(): LeaveType {
    return this.props.leaveType;
  }
  get startDate(): Date {
    return this.props.startDate;
  }
  get endDate(): Date {
    return this.props.endDate;
  }
  get days(): number {
    return this.props.days;
  }
  get reason(): string | null {
    return this.props.reason;
  }
  get status(): LeaveStatus {
    return this.props.status;
  }
  get requestedByUserId(): number | null {
    return this.props.requestedByUserId;
  }
  get decidedByUserId(): number | null {
    return this.props.decidedByUserId;
  }
  get decidedAt(): Date | null {
    return this.props.decidedAt;
  }
  get decisionNote(): string | null {
    return this.props.decisionNote;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isPending(): boolean {
    return this.props.status === 'pending';
  }

  isApproved(): boolean {
    return this.props.status === 'approved';
  }

  // ---------------------------------------------------------------------------
  // Davranışlar — yeni instance döner
  // ---------------------------------------------------------------------------

  /** Status geçişi — yasaksa InvalidLeaveTransitionError fırlatır. */
  private transitionTo(
    newStatus: LeaveStatus,
    now: Date,
    decision: { decidedByUserId?: number | null; decisionNote?: string | null },
  ): LeaveRequest {
    if (!isLeaveTransitionAllowed(this.props.status, newStatus)) {
      throw new InvalidLeaveTransitionError(this.props.status, newStatus);
    }
    return new LeaveRequest({
      ...this.props,
      status: newStatus,
      decidedByUserId:
        decision.decidedByUserId !== undefined
          ? decision.decidedByUserId
          : this.props.decidedByUserId,
      decidedAt: now,
      decisionNote:
        decision.decisionNote !== undefined ? decision.decisionNote : this.props.decisionNote,
      updatedAt: now,
    });
  }

  /** İzni onayla (pending → approved). */
  approve(now: Date, actorUserId: number | null, note: string | null = null): LeaveRequest {
    return this.transitionTo('approved', now, {
      decidedByUserId: actorUserId,
      decisionNote: note,
    });
  }

  /** İzni reddet (pending → rejected). */
  reject(now: Date, actorUserId: number | null, note: string | null = null): LeaveRequest {
    return this.transitionTo('rejected', now, {
      decidedByUserId: actorUserId,
      decisionNote: note,
    });
  }

  /** İzni iptal et (pending|approved → cancelled). */
  cancel(now: Date, actorUserId: number | null, note: string | null = null): LeaveRequest {
    return this.transitionTo('cancelled', now, {
      decidedByUserId: actorUserId,
      decisionNote: note,
    });
  }

  toJSON(): Readonly<LeaveRequestProps> {
    return { ...this.props };
  }
}
