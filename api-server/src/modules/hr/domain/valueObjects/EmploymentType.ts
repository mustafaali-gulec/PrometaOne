/**
 * EmploymentType — istihdam türü.
 *
 * full_time   — tam zamanlı
 * part_time   — yarı zamanlı
 * contract    — sözleşmeli (belirli süreli)
 * intern      — stajyer
 *
 * Faz 7 (Payroll) bu alana göre vergi/SGK kuralları uygular.
 */
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern';

export const ALL_EMPLOYMENT_TYPES: ReadonlyArray<EmploymentType> = [
  'full_time',
  'part_time',
  'contract',
  'intern',
];

export function isEmploymentType(value: unknown): value is EmploymentType {
  return (
    typeof value === 'string' && (ALL_EMPLOYMENT_TYPES as ReadonlyArray<string>).includes(value)
  );
}
