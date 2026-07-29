/**
 * Inspection / InspectionTemplate — Denetleme ve Taşeron Karne Formu (FAZ 6).
 * Tablolar: cs_inspection_templates, cs_inspection_template_items,
 *           cs_inspections, cs_inspection_answers (011_quality_safety.sql)
 *
 * MADDE METNİ VE AĞIRLIĞI CEVABA KOPYALANIR. Şablon sonradan düzenlenirse eski
 * denetimin neyi puanladığı kaybolmasın: karne tarihsel bir belgedir, "geçen ay
 * 85 aldı" ifadesi o günün maddelerine göre anlamlıdır.
 *
 * PUAN TÜRETİLİR AMA KAYDEDİLİR. Aynı nedenle: şablon ağırlıkları değişince
 * geçmiş puanlar oynamamalı.
 */
import {
  ConstructionValidationError,
  InspectionNotEditableError,
  InvalidStatusTransitionError,
} from '../errors/ConstructionErrors.js';
import {
  canTransitionInspection,
  computeInspectionScore,
  type InspectionScoring,
  type InspectionStatus,
  type InspectionTemplateKind,
  type ScoreResult,
} from '../valueObjects/QualitySafety.js';

// ===== ŞABLON ===============================================================

export interface InspectionTemplateItemProps {
  id: number;
  companyId: number;
  templateId: number;
  category: string | null;
  code: string;
  text: string;
  weight: number;
  maxScore: number;
  isCritical: boolean;
  sortOrder: number;
}

export interface InspectionTemplateProps {
  id: number;
  companyId: number;
  code: string;
  name: string;
  kind: InspectionTemplateKind;
  description: string | null;
  scoring: InspectionScoring;
  passPct: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  items: ReadonlyArray<InspectionTemplateItemProps>;
}

export class InspectionTemplate {
  private constructor(private readonly props: Readonly<InspectionTemplateProps>) {}

  static create(props: InspectionTemplateProps): InspectionTemplate {
    if (props.name.trim() === '') {
      throw new ConstructionValidationError('şablon adı boş olamaz');
    }
    if (props.passPct < 0 || props.passPct > 100) {
      throw new ConstructionValidationError('geçme eşiği 0-100 aralığında olmalı');
    }
    for (const it of props.items) {
      if (it.text.trim() === '') {
        throw new ConstructionValidationError('denetim maddesi metni boş olamaz');
      }
      if (it.maxScore <= 0) {
        throw new ConstructionValidationError('madde tam puanı 0 olamaz');
      }
      if (it.weight < 0) {
        throw new ConstructionValidationError('madde ağırlığı negatif olamaz');
      }
    }
    const codes = new Set(props.items.map((i) => i.code));
    if (codes.size !== props.items.length) {
      throw new ConstructionValidationError('şablonda madde kodu tekrar edemez');
    }
    return new InspectionTemplate(props);
  }

  get id(): number {
    return this.props.id;
  }
  get passPct(): number {
    return this.props.passPct;
  }
  get kind(): InspectionTemplateKind {
    return this.props.kind;
  }
  get items(): ReadonlyArray<InspectionTemplateItemProps> {
    return this.props.items;
  }
  /** Karne formu taşerona puan verir; taşeronsuz denetim anlamsız olur. */
  get requiresVendor(): boolean {
    return this.props.kind === 'subcontractor_scorecard';
  }

  toJSON(): InspectionTemplateProps {
    return { ...this.props, items: this.props.items.map((i) => ({ ...i })) };
  }
}

// ===== DENETİM ==============================================================

export interface InspectionAnswerProps {
  id: number;
  companyId: number;
  inspectionId: number;
  itemId: number;
  itemText: string;
  weight: number;
  maxScore: number;
  score: number | null;
  isNa: boolean;
  note: string | null;
  /** Başarısız maddeden doğan hasar-eksiklik kaydı. */
  defectId: number | null;
  /** Şablondan gelir; puanlamada eşiği ezmek için taşınır (DB'de saklanmaz). */
  isCritical?: boolean;
}

export interface InspectionProps {
  id: number;
  companyId: number;
  projectId: number;
  templateId: number;
  locationId: number | null;
  code: string;
  vendorId: number | null;
  contractId: number | null;
  inspectorUserId: number | null;
  inspectionDate: string;
  periodLabel: string | null;
  status: InspectionStatus;
  note: string | null;
  totalScore: number;
  maxScore: number;
  scorePct: number | null;
  grade: string | null;
  passed: boolean | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  answers: ReadonlyArray<InspectionAnswerProps>;
  /** Şablonun geçme eşiği; puanlama için taşınır. */
  passPct: number;
}

export interface AnswerInput {
  itemId: number;
  score?: number | null;
  isNa?: boolean;
  note?: string | null;
}

export class Inspection {
  private constructor(private readonly props: Readonly<InspectionProps>) {}

  static create(props: InspectionProps): Inspection {
    if (props.code.trim() === '') {
      throw new ConstructionValidationError('denetim kodu boş olamaz');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(props.inspectionDate)) {
      throw new ConstructionValidationError('denetim tarihi YYYY-MM-DD olmalı');
    }
    for (const a of props.answers) {
      if (a.isNa && a.score !== null) {
        throw new ConstructionValidationError('uygulanamaz madde puanlanamaz');
      }
      if (a.score !== null && (a.score < 0 || a.score > a.maxScore)) {
        throw new ConstructionValidationError(
          `madde puanı 0-${String(a.maxScore)} aralığında olmalı`,
        );
      }
    }
    return new Inspection(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get status(): InspectionStatus {
    return this.props.status;
  }
  get answers(): ReadonlyArray<InspectionAnswerProps> {
    return this.props.answers;
  }
  /** Taslak ve tamamlanmış denetim düzenlenebilir; onaylanmış/iptal edilmiş DEĞİL. */
  get editable(): boolean {
    return this.props.status === 'draft' || this.props.status === 'completed';
  }

  score(): ScoreResult {
    return computeInspectionScore(this.props.answers, this.props.passPct);
  }

  /**
   * Cevapları yazar ve puanı yeniden hesaplar.
   *
   * Puan HER YAZIMDA tazelenir: kullanıcı "tamamla"ya basmayı unutsa bile liste
   * ekranındaki yüzde gerçeği göstersin. Onaylanmış denetim reddedilir (400) —
   * karne o puanla yayınlandı.
   */
  setAnswers(inputs: ReadonlyArray<AnswerInput>, now: Date): Inspection {
    if (!this.editable) {
      throw new InspectionNotEditableError(this.props.id, this.props.status);
    }

    const byItem = new Map(inputs.map((i) => [i.itemId, i]));
    const answers = this.props.answers.map((a) => {
      const inp = byItem.get(a.itemId);
      if (inp === undefined) return a;
      const isNa = inp.isNa ?? a.isNa;
      // Uygulanamaz işaretlenen madde puanını KAYBEDER: yoksa "N/A ama 3 puan"
      // gibi hem paydan hem paydadan düşülmüş ama puanı duran satır kalır.
      const score = isNa ? null : (inp.score ?? a.score);
      if (score !== null && (score < 0 || score > a.maxScore)) {
        throw new ConstructionValidationError(
          `"${a.itemText}" için puan 0-${String(a.maxScore)} aralığında olmalı`,
        );
      }
      return { ...a, isNa, score, note: inp.note ?? a.note };
    });

    const scored = computeInspectionScore(answers, this.props.passPct);
    return new Inspection({
      ...this.props,
      answers,
      totalScore: scored.totalScore,
      maxScore: scored.maxScore,
      scorePct: scored.scorePct,
      grade: scored.grade,
      passed: scored.passed,
      updatedAt: now,
    });
  }

  changeStatus(to: InspectionStatus, now: Date): Inspection {
    const from = this.props.status;
    if (from === to) return this;
    if (!canTransitionInspection(from, to)) {
      throw new InvalidStatusTransitionError(from, to);
    }
    // Tamamlanan denetim puansız olamaz (DB'de de CHECK var): puanlanacak madde
    // yoksa denetim tamamlanmış sayılamaz, boş form imzalanmış olur.
    if (to === 'completed' || to === 'approved') {
      const scored = this.score();
      if (scored.scorePct === null) {
        throw new ConstructionValidationError(
          'puanlanmış madde yok — denetim tamamlanamaz (boş form)',
        );
      }
      return new Inspection({
        ...this.props,
        status: to,
        totalScore: scored.totalScore,
        maxScore: scored.maxScore,
        scorePct: scored.scorePct,
        grade: scored.grade,
        passed: scored.passed,
        completedAt: this.props.completedAt ?? now,
        updatedAt: now,
      });
    }
    // Taslağa dönüş: tamamlanma izi silinir, puan durur (yeniden hesaplanacak).
    return new Inspection({
      ...this.props,
      status: to,
      completedAt: to === 'draft' ? null : this.props.completedAt,
      updatedAt: now,
    });
  }

  toJSON(): InspectionProps {
    return { ...this.props, answers: this.props.answers.map((a) => ({ ...a })) };
  }
}
