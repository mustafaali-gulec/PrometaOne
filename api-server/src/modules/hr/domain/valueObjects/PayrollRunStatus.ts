/**
 * PayrollRunStatus — bordro koşusu yaşam döngüsü durum makinesi.
 *
 *   draft     → finalized
 *   finalized → (terminal)
 *
 * Yasak: finalized → herhangi bir şey (kesinleşmiş bordro değiştirilemez).
 */
export type PayrollRunStatus = 'draft' | 'finalized';

export const ALL_PAYROLL_RUN_STATUSES: ReadonlyArray<PayrollRunStatus> = ['draft', 'finalized'];

export const TERMINAL_PAYROLL_RUN_STATUSES: ReadonlyArray<PayrollRunStatus> = ['finalized'];

export function isTerminalPayrollRunStatus(status: PayrollRunStatus): boolean {
  return TERMINAL_PAYROLL_RUN_STATUSES.includes(status);
}

export function allowedPayrollRunTransitions(
  from: PayrollRunStatus,
): ReadonlyArray<PayrollRunStatus> {
  switch (from) {
    case 'draft':
      return ['finalized'];
    case 'finalized':
      return []; // terminal
  }
}

export function isPayrollRunTransitionAllowed(
  from: PayrollRunStatus,
  to: PayrollRunStatus,
): boolean {
  return allowedPayrollRunTransitions(from).includes(to);
}

export class InvalidPayrollRunTransitionError extends Error {
  constructor(
    public readonly from: PayrollRunStatus,
    public readonly to: PayrollRunStatus,
  ) {
    super(`PayrollRun status geçişi yasak: ${from} → ${to}`);
    this.name = 'InvalidPayrollRunTransitionError';
  }
}
