/**
 * UnitChangeRequest — müşteri değişiklik isteği (FAZ 10).
 * Tablo: cs_unit_change_requests (015_unit_sales.sql)
 *
 * Daire özelinde kapsam değişikliği (mutfak dolabı, zemin, ilave priz...).
 * DURUM: open → approved | rejected; approved → done | rejected; done ve
 * rejected terminal. approved → rejected bilerek VAR: müşteri onayladıktan
 * sonra vazgeçebilir; bunu "hiç istenmedi" gibi silmek yerine gerekçeli redde
 * çevirmek izi korur.
 *
 * BEDEL SÖZLEŞMESEL: onaylanan/biten isteğin bedeli daire kalanına eklenir
 * (kalan = satış + Σonaylı değişiklik − tahsilat). Bu yüzden bedel yalnız
 * `open` durumda düzenlenebilir — onaydan sonra oynatmak müşteriyle mutabık
 * kalınan sayıyı sessizce değiştirmek olur; fiyat değişecekse yeni istek açılır.
 */
import {
  ChangeRequestNotEditableError,
  ConstructionValidationError,
  InvalidStatusTransitionError,
} from '../errors/ConstructionErrors.js';

export const CHANGE_REQUEST_STATUSES = ['open', 'approved', 'rejected', 'done'] as const;
export type ChangeRequestStatus = (typeof CHANGE_REQUEST_STATUSES)[number];

const TRANSITIONS: Record<ChangeRequestStatus, ReadonlyArray<ChangeRequestStatus>> = {
  open: ['approved', 'rejected'],
  approved: ['done', 'rejected'],
  rejected: [],
  done: [],
};

export interface UnitChangeRequestProps {
  id: number;
  companyId: number;
  saleId: number;
  code: string;
  title: string;
  description: string | null;
  cost: number;
  status: ChangeRequestStatus;
  requestedAt: string;
  decidedAt: string | null;
  decidedBy: number | null;
  doneAt: string | null;
  note: string | null;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChangeRequestUpdate {
  title?: string | undefined;
  description?: string | null | undefined;
  cost?: number | undefined;
  note?: string | null | undefined;
}

export class UnitChangeRequest {
  private constructor(private readonly props: Readonly<UnitChangeRequestProps>) {}

  static create(props: UnitChangeRequestProps): UnitChangeRequest {
    if (props.title.trim() === '') {
      throw new ConstructionValidationError('değişiklik isteği başlığı boş olamaz');
    }
    if (props.cost < 0) {
      throw new ConstructionValidationError('değişiklik bedeli negatif olamaz');
    }
    return new UnitChangeRequest(props);
  }

  get id(): number {
    return this.props.id;
  }
  get status(): ChangeRequestStatus {
    return this.props.status;
  }
  get cost(): number {
    return this.props.cost;
  }
  get allowedTransitions(): ReadonlyArray<ChangeRequestStatus> {
    return TRANSITIONS[this.props.status];
  }

  update(patch: ChangeRequestUpdate, now: Date): UnitChangeRequest {
    // Onaylanan bedel sözleşmeseldir; başlık/açıklama da mutabakatın parçası.
    // Terminal durumda ve onay sonrasında yalnız not düzeltilebilir.
    if (this.props.status !== 'open') {
      const touchesData = Object.keys(patch).some((k) => k !== 'note');
      if (touchesData) throw new ChangeRequestNotEditableError(this.props.status);
    }
    if (patch.title !== undefined && patch.title.trim() === '') {
      throw new ConstructionValidationError('değişiklik isteği başlığı boş olamaz');
    }
    if (patch.cost !== undefined && patch.cost < 0) {
      throw new ConstructionValidationError('değişiklik bedeli negatif olamaz');
    }
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    ) as Partial<UnitChangeRequestProps>;
    return new UnitChangeRequest({ ...this.props, ...clean, updatedAt: now });
  }

  transition(
    to: ChangeRequestStatus,
    input: { note?: string | null | undefined; decidedBy?: number | null | undefined },
    now: Date,
  ): UnitChangeRequest {
    if (!TRANSITIONS[this.props.status].includes(to)) {
      throw new InvalidStatusTransitionError(this.props.status, to);
    }
    if (
      to === 'rejected' &&
      (input.note === undefined || input.note === null || input.note.trim() === '')
    ) {
      // Müşteriye "reddedildi" demenin gerekçesi kayıtta durmalı — özellikle
      // approved→rejected geri dönüşünde.
      throw new ConstructionValidationError('red gerekçesi zorunludur');
    }
    const today = now.toISOString().slice(0, 10);
    const next: UnitChangeRequestProps = { ...this.props, status: to, updatedAt: now };
    if (to === 'approved' || to === 'rejected') {
      next.decidedAt = today;
      next.decidedBy = input.decidedBy ?? null;
    }
    if (to === 'done') next.doneAt = today;
    if (input.note !== undefined && input.note !== null && input.note.trim() !== '') {
      next.note = input.note.trim();
    }
    return new UnitChangeRequest(next);
  }

  toJSON(): UnitChangeRequestProps {
    return { ...this.props };
  }
}
