/**
 * Hakediş tip/yön/durum ENUM aynaları + durum geçiş kuralları.
 *
 * Durum makinesi:
 *   draft → submitted → approved → paid
 *   submitted → rejected → draft (yeniden düzenleme)
 *   (paid hariç her durum) → cancelled
 */
export const PROGRESS_KINDS = ['employer', 'subcontractor'] as const;
export type ProgressKind = (typeof PROGRESS_KINDS)[number];

export const PROGRESS_TYPES = ['interim', 'final'] as const;
export type ProgressType = (typeof PROGRESS_TYPES)[number];

export const PROGRESS_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'paid',
  'cancelled',
] as const;
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];

export function isProgressKind(v: unknown): v is ProgressKind {
  return typeof v === 'string' && (PROGRESS_KINDS as ReadonlyArray<string>).includes(v);
}
export function isProgressStatus(v: unknown): v is ProgressStatus {
  return typeof v === 'string' && (PROGRESS_STATUSES as ReadonlyArray<string>).includes(v);
}

const ALLOWED: Readonly<Record<ProgressStatus, ReadonlyArray<ProgressStatus>>> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['approved', 'rejected', 'cancelled'],
  approved: ['paid', 'cancelled'],
  rejected: ['draft', 'cancelled'],
  paid: [],
  cancelled: [],
};

export function canTransitionProgress(from: ProgressStatus, to: ProgressStatus): boolean {
  if (from === to) return false;
  return ALLOWED[from].includes(to);
}

/** Satır/kesinti düzenlemeye açık durumlar (taslak veya reddedilmiş). */
export function isEditableStatus(status: ProgressStatus): boolean {
  return status === 'draft' || status === 'rejected';
}
