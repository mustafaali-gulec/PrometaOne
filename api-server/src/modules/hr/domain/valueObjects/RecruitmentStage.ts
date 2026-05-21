/**
 * RecruitmentStage — başvuru yaşam döngüsü durum makinesi.
 *
 * Pipeline:
 *   new        → screening | rejected | withdrawn
 *   screening  → interview | rejected | withdrawn
 *   interview  → offer     | rejected | withdrawn
 *   offer      → hired     | rejected | withdrawn
 *   hired      → (terminal)
 *   rejected   → (terminal)
 *   withdrawn  → (terminal)
 *
 * Notlar:
 *   - "hired" terminal — sonradan değiştirilemez (Employee tarafına yansıtılır).
 *   - "rejected" / "withdrawn" terminal — yeni başvuru yapılabilir (DB partial
 *     unique index `uq_applications_active_unique` ile garanti).
 *   - Geriye sayım atlama: rejected → screening gibi → reddedilir.
 */
export type RecruitmentStage =
  | 'new'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'hired'
  | 'rejected'
  | 'withdrawn';

export const ALL_RECRUITMENT_STAGES: ReadonlyArray<RecruitmentStage> = [
  'new',
  'screening',
  'interview',
  'offer',
  'hired',
  'rejected',
  'withdrawn',
];

export const TERMINAL_STAGES: ReadonlyArray<RecruitmentStage> = ['hired', 'rejected', 'withdrawn'];

export const ACTIVE_STAGES: ReadonlyArray<RecruitmentStage> = [
  'new',
  'screening',
  'interview',
  'offer',
];

export function isTerminalStage(stage: RecruitmentStage): boolean {
  return TERMINAL_STAGES.includes(stage);
}

export function allowedStageTransitions(from: RecruitmentStage): ReadonlyArray<RecruitmentStage> {
  switch (from) {
    case 'new':
      return ['screening', 'rejected', 'withdrawn'];
    case 'screening':
      return ['interview', 'rejected', 'withdrawn'];
    case 'interview':
      return ['offer', 'rejected', 'withdrawn'];
    case 'offer':
      return ['hired', 'rejected', 'withdrawn'];
    case 'hired':
    case 'rejected':
    case 'withdrawn':
      return []; // terminal
  }
}

export function isStageTransitionAllowed(from: RecruitmentStage, to: RecruitmentStage): boolean {
  return allowedStageTransitions(from).includes(to);
}

export class InvalidStageTransitionError extends Error {
  constructor(
    public readonly from: RecruitmentStage,
    public readonly to: RecruitmentStage,
  ) {
    super(`Application stage geçişi yasak: ${from} → ${to}`);
    this.name = 'InvalidStageTransitionError';
  }
}
