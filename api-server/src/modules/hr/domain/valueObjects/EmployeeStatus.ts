/**
 * EmployeeStatus — çalışan yaşam döngüsü durum makinesi.
 *
 *   probation  → active           (deneme süresi onaylandı)
 *   probation  → terminated       (deneme süresi reddi)
 *   active     → on_leave         (izinli — analık, askerlik, vb.)
 *   active     → terminated       (işten ayrılış)
 *   on_leave   → active           (izinden dönüş)
 *   on_leave   → terminated       (izindeyken ayrılış)
 *
 * Yasak: terminated → herhangi bir şey (terminal); active → probation (geri).
 */
export type EmployeeStatus = 'probation' | 'active' | 'on_leave' | 'terminated';

export const ALL_EMPLOYEE_STATUSES: ReadonlyArray<EmployeeStatus> = [
  'probation',
  'active',
  'on_leave',
  'terminated',
];

export function allowedEmployeeTransitions(from: EmployeeStatus): ReadonlyArray<EmployeeStatus> {
  switch (from) {
    case 'probation':
      return ['active', 'terminated'];
    case 'active':
      return ['on_leave', 'terminated'];
    case 'on_leave':
      return ['active', 'terminated'];
    case 'terminated':
      return []; // terminal state
  }
}

export function isEmployeeTransitionAllowed(from: EmployeeStatus, to: EmployeeStatus): boolean {
  return allowedEmployeeTransitions(from).includes(to);
}

export class InvalidEmployeeTransitionError extends Error {
  constructor(
    public readonly from: EmployeeStatus,
    public readonly to: EmployeeStatus,
  ) {
    super(`Employee status geçişi yasak: ${from} → ${to}`);
    this.name = 'InvalidEmployeeTransitionError';
  }
}
