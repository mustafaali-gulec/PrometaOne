/**
 * LeaveStatus — izin talebi yaşam döngüsü durum makinesi.
 *
 *   pending   → approved | rejected | cancelled
 *   approved  → cancelled              (onaylı izin iptal edilebilir)
 *   rejected  → (terminal)
 *   cancelled → (terminal)
 *
 * Yasak: rejected/cancelled → herhangi bir şey (terminal); approved → rejected.
 */
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export const ALL_LEAVE_STATUSES: ReadonlyArray<LeaveStatus> = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
];

export const TERMINAL_LEAVE_STATUSES: ReadonlyArray<LeaveStatus> = ['rejected', 'cancelled'];

export function isTerminalLeaveStatus(status: LeaveStatus): boolean {
  return TERMINAL_LEAVE_STATUSES.includes(status);
}

export function allowedLeaveTransitions(from: LeaveStatus): ReadonlyArray<LeaveStatus> {
  switch (from) {
    case 'pending':
      return ['approved', 'rejected', 'cancelled'];
    case 'approved':
      return ['cancelled'];
    case 'rejected':
    case 'cancelled':
      return []; // terminal
  }
}

export function isLeaveTransitionAllowed(from: LeaveStatus, to: LeaveStatus): boolean {
  return allowedLeaveTransitions(from).includes(to);
}

export class InvalidLeaveTransitionError extends Error {
  constructor(
    public readonly from: LeaveStatus,
    public readonly to: LeaveStatus,
  ) {
    super(`LeaveRequest status geçişi yasak: ${from} → ${to}`);
    this.name = 'InvalidLeaveTransitionError';
  }
}
