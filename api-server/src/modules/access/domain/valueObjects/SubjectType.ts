/**
 * SubjectType — bir rol grant'inin atandığı öznenin türü.
 *
 * 'user'      → subjectId = username (TEXT)
 * diğerleri   → subjectId = ilgili kaydın numeric id'sinin text hali
 */

export const ALL_SUBJECT_TYPES = [
  'user',
  'employee',
  'job_title',
  'department',
  'org_unit',
] as const;

export type SubjectType = (typeof ALL_SUBJECT_TYPES)[number];

export function isSubjectType(value: unknown): value is SubjectType {
  return typeof value === 'string' && (ALL_SUBJECT_TYPES as ReadonlyArray<string>).includes(value);
}
