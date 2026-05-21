/**
 * ApplicationStageTransitionPolicy — Application stage geçişlerinin politikası.
 *
 * Saf domain — burada Application entity'sinin `transitionTo` davranışını
 * sarmalayan ek iş kuralları ele alınır. Şu an için sadece "transition
 * mümkün mü" sorusunu cevaplar; ilerideki PR'larda role-based kısıtlamalar
 * (örn. sadece hr_manager 'offer' yapabilir) buraya eklenebilir.
 */
import {
  allowedStageTransitions,
  isStageTransitionAllowed,
  type RecruitmentStage,
} from '../valueObjects/RecruitmentStage.js';

export class ApplicationStageTransitionPolicy {
  /** Verilen geçiş mümkün mü? */
  static canTransition(from: RecruitmentStage, to: RecruitmentStage): boolean {
    return isStageTransitionAllowed(from, to);
  }

  /** Mevcut stage'den geçilebilecek tüm stage'ler. */
  static nextAllowed(from: RecruitmentStage): ReadonlyArray<RecruitmentStage> {
    return allowedStageTransitions(from);
  }
}
