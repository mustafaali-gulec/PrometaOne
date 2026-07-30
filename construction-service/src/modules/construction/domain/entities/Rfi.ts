/**
 * Rfi — Bilgi Talebi (FAZ 6).
 * Tablo: cs_rfis (011_quality_safety.sql)
 *
 * SÜRE VE MALİYET ETKİSİ (`impactDays` / `impactCost`) kaydın çekirdeğinde:
 * kamu ihalesinde süre uzatımı talebinin dayanağı cevapsız kalan bilgi
 * talepleridir. Etki alanı olmayan bir RFI listesi hukuken işe yaramaz.
 *
 * `answered → open` KASITLI: cevap yetersizse soru sürüyor demektir. Kapatma
 * cevap ŞART DEĞİL — soru imalat değiştiği için geçersizleşebilir; o durumda
 * "cevaplandı" demek yalan olur.
 */
import {
  ConstructionValidationError,
  InvalidStatusTransitionError,
} from '../errors/ConstructionErrors.js';
import type { CurrencyCode } from '../valueObjects/Currency.js';
import {
  canTransitionRfi,
  overdueDays,
  type Priority,
  type RfiDiscipline,
  type RfiStatus,
} from '../valueObjects/QualitySafety.js';

export interface RfiProps {
  id: number;
  companyId: number;
  projectId: number;
  locationId: number | null;
  code: string;
  subject: string;
  question: string;
  discipline: RfiDiscipline;
  priority: Priority;
  status: RfiStatus;
  askedBy: number | null;
  askedToUserId: number | null;
  vendorId: number | null;
  boqLineId: number | null;
  dueDate: string | null;
  answer: string | null;
  answeredBy: number | null;
  answeredAt: Date | null;
  closedAt: Date | null;
  impactDays: number;
  impactCost: number;
  currency: CurrencyCode;
  createdAt: Date;
  updatedAt: Date;
}

export interface RfiUpdate {
  locationId?: number | null;
  subject?: string;
  question?: string;
  discipline?: RfiDiscipline;
  priority?: Priority;
  askedToUserId?: number | null;
  vendorId?: number | null;
  boqLineId?: number | null;
  dueDate?: string | null;
  impactDays?: number;
  impactCost?: number;
  currency?: CurrencyCode;
}

export class Rfi {
  private constructor(private readonly props: Readonly<RfiProps>) {}

  static create(props: RfiProps): Rfi {
    if (props.subject.trim() === '') {
      throw new ConstructionValidationError('bilgi talebi konusu boş olamaz');
    }
    if (props.question.trim() === '') {
      throw new ConstructionValidationError('bilgi talebi sorusu boş olamaz');
    }
    if (props.impactDays < 0) {
      throw new ConstructionValidationError('süre etkisi negatif olamaz');
    }
    if (props.impactCost < 0) {
      throw new ConstructionValidationError('maliyet etkisi negatif olamaz');
    }
    if (props.status === 'answered' && (props.answer === null || props.answer.trim() === '')) {
      throw new ConstructionValidationError('cevaplanmış bilgi talebi cevapsız olamaz');
    }
    return new Rfi(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get status(): RfiStatus {
    return this.props.status;
  }
  get open(): boolean {
    return this.props.status === 'open';
  }

  overdueDays(today: string): number | null {
    return overdueDays(this.props.dueDate, this.open, today);
  }

  /** Açık RFI'ın yaşı (gün) — süre uzatımı talebinin dayanağı. */
  ageDays(today: string): number {
    const created = this.props.createdAt.toISOString().slice(0, 10);
    const diff = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${created}T00:00:00Z`);
    return Math.max(0, Math.round(diff / 86_400_000));
  }

  update(patch: RfiUpdate, now: Date): Rfi {
    if (patch.subject !== undefined && patch.subject.trim() === '') {
      throw new ConstructionValidationError('bilgi talebi konusu boş olamaz');
    }
    if (patch.question !== undefined && patch.question.trim() === '') {
      throw new ConstructionValidationError('bilgi talebi sorusu boş olamaz');
    }
    if (patch.impactDays !== undefined && patch.impactDays < 0) {
      throw new ConstructionValidationError('süre etkisi negatif olamaz');
    }
    if (patch.impactCost !== undefined && patch.impactCost < 0) {
      throw new ConstructionValidationError('maliyet etkisi negatif olamaz');
    }
    return new Rfi({ ...this.props, ...patch, updatedAt: now });
  }

  /** Cevap yazmak durumu 'answered'a taşır — ayrı iki adım kullanıcıyı şaşırtır. */
  answerQuestion(answer: string, actor: number | null, now: Date): Rfi {
    if (answer.trim() === '') {
      throw new ConstructionValidationError('cevap boş olamaz');
    }
    if (this.props.status === 'closed' || this.props.status === 'cancelled') {
      throw new InvalidStatusTransitionError(this.props.status, 'answered');
    }
    return new Rfi({
      ...this.props,
      status: 'answered',
      answer: answer.trim(),
      answeredBy: actor,
      answeredAt: now,
      updatedAt: now,
    });
  }

  changeStatus(to: RfiStatus, now: Date): Rfi {
    const from = this.props.status;
    if (from === to) return this;
    if (!canTransitionRfi(from, to)) {
      throw new InvalidStatusTransitionError(from, to);
    }
    if (to === 'answered') {
      // Durumu elle 'answered' yapmak cevap gerektirir; cevap yazma yolu
      // answerQuestion() — bu dal yalnız cevabı zaten yazılmış kayıt için.
      if (this.props.answer === null || this.props.answer.trim() === '') {
        throw new ConstructionValidationError('cevaplanmış bilgi talebi cevapsız olamaz');
      }
    }
    const next: RfiProps = { ...this.props, status: to, updatedAt: now };
    if (to === 'closed') next.closedAt = now;
    if (to === 'open') {
      // Yeniden açılış: cevap METNİ KORUNUR (yetersiz de olsa verilmiş bir
      // cevaptır ve iz değeri taşır), yalnız kapanış izi silinir.
      next.closedAt = null;
    }
    return new Rfi(next);
  }

  toJSON(): RfiProps {
    return { ...this.props };
  }
}
