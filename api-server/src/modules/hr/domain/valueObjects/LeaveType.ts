/**
 * LeaveType — izin türü.
 *
 * annual     — yıllık ücretli izin (bakiyeden düşülür)
 * sick       — hastalık / rapor izni
 * unpaid     — ücretsiz izin
 * maternity  — doğum / analık izni
 * other      — diğer
 *
 * Bakiye hesabı (GetLeaveBalanceUseCase) yalnızca 'annual' türü dikkate alır.
 */
export type LeaveType = 'annual' | 'sick' | 'unpaid' | 'maternity' | 'other';

export const ALL_LEAVE_TYPES: ReadonlyArray<LeaveType> = [
  'annual',
  'sick',
  'unpaid',
  'maternity',
  'other',
];

export function isLeaveType(value: unknown): value is LeaveType {
  return typeof value === 'string' && (ALL_LEAVE_TYPES as ReadonlyArray<string>).includes(value);
}
