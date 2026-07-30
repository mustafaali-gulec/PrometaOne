/**
 * Defect — Hasar-Eksiklik kaydı (FAZ 6).
 * Tablo: cs_defects (011_quality_safety.sql)
 *
 * Durum makinesi: open ⇄ in_progress → fixed → verified → closed
 * `fixed → open` ve `verified → open` KASITLI: doğrulamada iş beğenilmezse
 * kayıt yeniden açılır ve `reopenCount` artar. Bu sayaç taşeron karnesinin en
 * anlamlı sinyali — "giderdim" deyip geçen iş başka hiçbir yerde görünmez.
 *
 * `closed` terminaldir. Kapanmış kusuru yeniden açmak, bir kaydın ömrü boyunca
 * kaç ayrı kusur yaşandığını sayılamaz hale getirir; yeni kayıt açılır.
 *
 * ZAMAN DAMGALARI DURUMLA TUTARLI TUTULUR: `fixed` olmadan `verified` olunamaz
 * (DB'de de CHECK var) ve yeniden açılan kayıtta doğrulama izi silinir — aksi
 * halde "doğrulanmış ama açık" gibi okunamaz bir satır kalır.
 */
import {
  ConstructionValidationError,
  InvalidStatusTransitionError,
} from '../errors/ConstructionErrors.js';
import type { CurrencyCode } from '../valueObjects/Currency.js';
import {
  canTransitionDefect,
  isDefectClosed,
  overdueDays,
  type DefectKind,
  type DefectSeverity,
  type DefectSource,
  type DefectStatus,
} from '../valueObjects/QualitySafety.js';

export interface DefectProps {
  id: number;
  companyId: number;
  projectId: number;
  locationId: number | null;
  code: string;
  title: string;
  description: string | null;
  defectKind: DefectKind;
  severity: DefectSeverity;
  status: DefectStatus;
  vendorId: number | null;
  responsibleUserId: number | null;
  reporterUserId: number | null;
  source: DefectSource;
  boqLineId: number | null;
  dueDate: string | null;
  fixedAt: Date | null;
  fixedBy: number | null;
  verifiedAt: Date | null;
  verifiedBy: number | null;
  closedAt: Date | null;
  costEstimate: number;
  costActual: number;
  currency: CurrencyCode;
  reopenCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DefectUpdate {
  locationId?: number | null;
  title?: string;
  description?: string | null;
  defectKind?: DefectKind;
  severity?: DefectSeverity;
  vendorId?: number | null;
  responsibleUserId?: number | null;
  boqLineId?: number | null;
  dueDate?: string | null;
  costEstimate?: number;
  costActual?: number;
  currency?: CurrencyCode;
}

export class Defect {
  private constructor(private readonly props: Readonly<DefectProps>) {}

  static create(props: DefectProps): Defect {
    if (props.title.trim() === '') {
      throw new ConstructionValidationError('hasar-eksiklik başlığı boş olamaz');
    }
    if (props.code.trim() === '') {
      throw new ConstructionValidationError('hasar-eksiklik kodu boş olamaz');
    }
    if (props.costEstimate < 0 || props.costActual < 0) {
      throw new ConstructionValidationError('maliyet negatif olamaz');
    }
    if (props.verifiedAt !== null && props.fixedAt === null) {
      throw new ConstructionValidationError(
        'doğrulanmış kayıt giderme kaydı olmadan olamaz (kim ne zaman giderdi kaybolur)',
      );
    }
    return new Defect(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get projectId(): number {
    return this.props.projectId;
  }
  get code(): string {
    return this.props.code;
  }
  get status(): DefectStatus {
    return this.props.status;
  }
  get severity(): DefectSeverity {
    return this.props.severity;
  }
  get reopenCount(): number {
    return this.props.reopenCount;
  }
  /** İşi bitmiş mi (verified/closed/rejected). */
  get isClosed(): boolean {
    return isDefectClosed(this.props.status);
  }
  get open(): boolean {
    return !this.isClosed;
  }

  /** Gecikme günü; kapanmış kayıtta null. */
  overdueDays(today: string): number | null {
    return overdueDays(this.props.dueDate, this.open, today);
  }

  update(patch: DefectUpdate, now: Date): Defect {
    if (patch.title !== undefined && patch.title.trim() === '') {
      throw new ConstructionValidationError('hasar-eksiklik başlığı boş olamaz');
    }
    if (patch.costEstimate !== undefined && patch.costEstimate < 0) {
      throw new ConstructionValidationError('maliyet negatif olamaz');
    }
    if (patch.costActual !== undefined && patch.costActual < 0) {
      throw new ConstructionValidationError('maliyet negatif olamaz');
    }
    return new Defect({ ...this.props, ...patch, updatedAt: now });
  }

  /**
   * Durum değişimi. Zaman damgaları burada tutulur — çağıranın elinde bırakmak
   * "giderildi ama fixedAt boş" gibi satırlar üretir.
   */
  changeStatus(to: DefectStatus, actor: number | null, now: Date): Defect {
    const from = this.props.status;
    if (from === to) return this;
    if (!canTransitionDefect(from, to)) {
      throw new InvalidStatusTransitionError(from, to);
    }

    const next: DefectProps = { ...this.props, status: to, updatedAt: now };

    switch (to) {
      case 'fixed':
        next.fixedAt = now;
        next.fixedBy = actor;
        break;
      case 'verified':
        next.verifiedAt = now;
        next.verifiedBy = actor;
        break;
      case 'closed':
        next.closedAt = now;
        break;
      case 'open':
        // YENİDEN AÇILIŞ. Giderme/doğrulama izi TEMİZLENİR: "doğrulanmış ama
        // açık" satırı hem raporu hem DB kısıtını bozar. Sayaç yalnız gerçekten
        // giderilmiş bir kayıt geri açılırken artar — reddedilmiş kaydın
        // yeniden açılması "tekrar eden kusur" değildir.
        if (from === 'fixed' || from === 'verified') {
          next.reopenCount = this.props.reopenCount + 1;
        }
        next.fixedAt = null;
        next.fixedBy = null;
        next.verifiedAt = null;
        next.verifiedBy = null;
        next.closedAt = null;
        break;
      default:
        break;
    }

    return new Defect(next);
  }

  toJSON(): DefectProps {
    return { ...this.props };
  }
}
