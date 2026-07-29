/**
 * Commitment — Taahhüt kaydı (FAZ 7).
 * Tablo: cs_commitments (012_commitments_evm.sql)
 *
 * Verilmiş ama henüz fiiliye dönmemiş para: sipariş, taşeron anlaşması, elle
 * girilen taahhüt. Satınalma monolitte kaynak-of-truth; buradaki kayıt
 * PROJEKSİYONDUR (köprü kararı) — o yüzden `source='purchase_order'` kayıtları
 * senkron ucundan idempotent upsert ile gelir, elle de düzenlenebilir ama
 * senkron bir sonraki koşuda kaynağın değerini geri yazar.
 *
 * DURUM MAKİNESİ: open → partial → closed, her açık durumdan cancelled.
 * `closed → open` YOK: kapanmış taahhüt tamamen teslim alınmış demektir; geri
 * açmak "teslim alınan mal geri gitti" demek olur ve bu ayrı bir iş (iade,
 * yeni taahhüt) olarak kaydedilmeli — maruziyet tarihçesi geriye doğru oynamaz.
 *
 * TESLİMAT: deliveredAmount arttıkça açık taahhüt (amount − delivered) erir;
 * tam teslimatta durum otomatik 'closed', kısmi teslimde 'partial' olur.
 * Durumun elle değil teslimattan türemesi "kapalı ama açık tutarlı" satırı
 * imkânsız kılar.
 */
import {
  ConstructionValidationError,
  InvalidStatusTransitionError,
} from '../errors/ConstructionErrors.js';
import type { CurrencyCode } from '../valueObjects/Currency.js';

export const COMMITMENT_SOURCES = ['purchase_order', 'subcontract', 'manual'] as const;
export type CommitmentSource = (typeof COMMITMENT_SOURCES)[number];

export const COMMITMENT_STATUSES = ['open', 'partial', 'closed', 'cancelled'] as const;
export type CommitmentStatus = (typeof COMMITMENT_STATUSES)[number];

export interface CommitmentProps {
  id: number;
  companyId: number;
  projectId: number;
  contractId: number | null;
  boqLineId: number | null;
  locationId: number | null;
  source: CommitmentSource;
  refNo: string;
  refLineNo: number;
  vendorId: number | null;
  description: string;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  amount: number;
  deliveredAmount: number;
  currency: CurrencyCode;
  status: CommitmentStatus;
  committedAt: string;
  closedAt: Date | null;
  note: string | null;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommitmentUpdate {
  contractId?: number | null | undefined;
  boqLineId?: number | null | undefined;
  locationId?: number | null | undefined;
  vendorId?: number | null | undefined;
  description?: string | undefined;
  quantity?: number | undefined;
  unit?: string | null | undefined;
  unitPrice?: number | undefined;
  amount?: number | undefined;
  committedAt?: string | undefined;
  note?: string | null | undefined;
}

/** Teslimat tutarından durum türetilir — elle "kapalı ama açık tutarlı" satır kurulamaz. */
function statusFor(amount: number, delivered: number, current: CommitmentStatus): CommitmentStatus {
  if (current === 'cancelled') return 'cancelled';
  if (amount > 0 && delivered >= amount) return 'closed';
  if (delivered > 0) return 'partial';
  return 'open';
}

export class Commitment {
  private constructor(private readonly props: Readonly<CommitmentProps>) {}

  static create(props: CommitmentProps): Commitment {
    if (props.description.trim() === '') {
      throw new ConstructionValidationError('taahhüt açıklaması boş olamaz');
    }
    if (props.refNo.trim() === '') {
      throw new ConstructionValidationError('taahhüt belge no boş olamaz');
    }
    if (props.amount < 0) {
      throw new ConstructionValidationError('taahhüt tutarı negatif olamaz');
    }
    if (props.deliveredAmount < 0 || props.deliveredAmount > props.amount) {
      throw new ConstructionValidationError(
        'teslim alınan tutar 0 ile taahhüt tutarı arasında olmalı',
      );
    }
    return new Commitment(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get status(): CommitmentStatus {
    return this.props.status;
  }
  get amount(): number {
    return this.props.amount;
  }
  /** Açık taahhüt — maruziyete giren kısım. Kapalı/iptalde 0. */
  get openAmount(): number {
    if (this.props.status === 'closed' || this.props.status === 'cancelled') return 0;
    return Math.max(0, this.props.amount - this.props.deliveredAmount);
  }
  get open(): boolean {
    return this.props.status === 'open' || this.props.status === 'partial';
  }

  update(patch: CommitmentUpdate, now: Date): Commitment {
    if (!this.open) {
      // Kapanmış/iptal edilmiş taahhüdün tutarını oynatmak maruziyet tarihçesini
      // bozar; yalnız not düzeltilebilir.
      const touchesMoney = Object.keys(patch).some((k) => k !== 'note');
      if (touchesMoney) {
        throw new InvalidStatusTransitionError(this.props.status, 'düzenleme');
      }
    }
    if (patch.description !== undefined && patch.description.trim() === '') {
      throw new ConstructionValidationError('taahhüt açıklaması boş olamaz');
    }
    if (patch.amount !== undefined && patch.amount < 0) {
      throw new ConstructionValidationError('taahhüt tutarı negatif olamaz');
    }
    const amount = patch.amount ?? this.props.amount;
    if (this.props.deliveredAmount > amount) {
      throw new ConstructionValidationError(
        'taahhüt tutarı teslim alınan tutarın altına indirilemez',
      );
    }
    // exactOptionalPropertyTypes: undefined alanlar spread'e girmesin
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    ) as Partial<CommitmentProps>;
    const next: CommitmentProps = { ...this.props, ...clean, updatedAt: now };
    next.status = statusFor(next.amount, next.deliveredAmount, next.status);
    return new Commitment(next);
  }

  /**
   * Teslimat kaydı: KÜMÜLATİF tutar alır (delta değil) — senkron ucu kaynaktan
   * her zaman kümülatif değeri okur, delta göndermek iki kez sayma riskini
   * senkronun sırasına bağlardı.
   */
  recordDelivery(deliveredAmount: number, now: Date): Commitment {
    if (this.props.status === 'cancelled') {
      throw new InvalidStatusTransitionError('cancelled', 'teslimat');
    }
    if (deliveredAmount < 0 || deliveredAmount > this.props.amount) {
      throw new ConstructionValidationError(
        'teslim alınan tutar 0 ile taahhüt tutarı arasında olmalı',
      );
    }
    // Teslimat geriye gitmez: kaynak sistem düşüş gönderiyorsa iade vardır ve
    // iade ayrı kayıt ister — sessizce düşürmek maruziyeti gizler.
    if (deliveredAmount < this.props.deliveredAmount) {
      throw new ConstructionValidationError(
        'teslim alınan tutar azaltılamaz (iade ayrı kayıt gerektirir)',
      );
    }
    const status = statusFor(this.props.amount, deliveredAmount, this.props.status);
    return new Commitment({
      ...this.props,
      deliveredAmount,
      status,
      closedAt: status === 'closed' ? (this.props.closedAt ?? now) : this.props.closedAt,
      updatedAt: now,
    });
  }

  /** Kalan açık tutarı taahhütten düşerek kapatır (kısmi teslimle biten sipariş). */
  close(now: Date): Commitment {
    if (!this.open) {
      throw new InvalidStatusTransitionError(this.props.status, 'closed');
    }
    return new Commitment({
      ...this.props,
      status: 'closed',
      closedAt: now,
      updatedAt: now,
    });
  }

  cancel(now: Date): Commitment {
    if (this.props.status === 'closed' || this.props.status === 'cancelled') {
      throw new InvalidStatusTransitionError(this.props.status, 'cancelled');
    }
    // Kısmen teslim alınmış sipariş iptal edilirse alınan kısım alınmış kalır;
    // iptal yalnız AÇIK kısmı maruziyetten düşürür.
    return new Commitment({
      ...this.props,
      status: 'cancelled',
      closedAt: now,
      updatedAt: now,
    });
  }

  toJSON(): CommitmentProps {
    return { ...this.props };
  }
}
