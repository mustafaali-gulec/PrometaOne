/**
 * ExpenseCard — Gider Kartı (kalıcı master kayıt). Tablo: expense_cards
 * (030_expense_cards.sql).
 *
 * Gider kartı bir gider/gelir kalemini (kasa kategorisi, masraf türü) temsil
 * eder: `code` otomatik üretilen kart kodu (örn GK0001), `direction` akış yönü
 * (in/out), `category` serbest kategori metni. Kasa Excel import'undan tespit
 * edilen distinct kalemler bu kartlara dönüşür.
 *
 * Immutable — update/deactivate yeni instance döner.
 */
export type FlowDirection = 'in' | 'out';

export interface ExpenseCardProps {
  id: number;
  companyId: number;
  code: string;
  name: string;
  category: string;
  direction: FlowDirection;
  defaultAccountCode: string | null;
  note: string | null;
  active: boolean;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpenseCardUpdate {
  name?: string;
  category?: string;
  direction?: FlowDirection;
  defaultAccountCode?: string | null;
  note?: string | null;
}

export class ExpenseCard {
  private constructor(private readonly props: Readonly<ExpenseCardProps>) {}

  static create(props: ExpenseCardProps): ExpenseCard {
    if (props.id <= 0) throw new Error('ExpenseCard.id pozitif olmalı');
    if (props.companyId <= 0) throw new Error('ExpenseCard.companyId pozitif olmalı');
    if (props.code.trim().length === 0) throw new Error('ExpenseCard.code boş olamaz');
    if (props.name.trim().length === 0) throw new Error('ExpenseCard.name boş olamaz');
    if (props.name.length > 300) throw new Error('ExpenseCard.name 300 karakteri geçemez');
    if (props.direction !== 'in' && props.direction !== 'out')
      throw new Error("ExpenseCard.direction 'in' veya 'out' olmalı");
    return new ExpenseCard({ ...props, category: props.category.trim() });
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get code(): string {
    return this.props.code;
  }
  get name(): string {
    return this.props.name;
  }
  get category(): string {
    return this.props.category;
  }
  get direction(): FlowDirection {
    return this.props.direction;
  }
  get defaultAccountCode(): string | null {
    return this.props.defaultAccountCode;
  }
  get note(): string | null {
    return this.props.note;
  }
  get active(): boolean {
    return this.props.active;
  }
  get createdBy(): number | null {
    return this.props.createdBy;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  update(changes: ExpenseCardUpdate, now: Date): ExpenseCard {
    const name = changes.name !== undefined ? changes.name.trim() : this.props.name;
    if (name.length === 0) throw new Error('ExpenseCard.name boş olamaz');
    if (name.length > 300) throw new Error('ExpenseCard.name 300 karakteri geçemez');
    const direction = changes.direction ?? this.props.direction;
    if (direction !== 'in' && direction !== 'out')
      throw new Error("ExpenseCard.direction 'in' veya 'out' olmalı");
    return new ExpenseCard({
      ...this.props,
      name,
      category: changes.category !== undefined ? changes.category.trim() : this.props.category,
      direction,
      defaultAccountCode:
        changes.defaultAccountCode !== undefined
          ? changes.defaultAccountCode
          : this.props.defaultAccountCode,
      note: changes.note !== undefined ? changes.note : this.props.note,
      updatedAt: now,
    });
  }

  deactivate(now: Date): ExpenseCard {
    if (!this.props.active) return this;
    return new ExpenseCard({ ...this.props, active: false, updatedAt: now });
  }

  withId(id: number): ExpenseCard {
    return new ExpenseCard({ ...this.props, id });
  }

  toJSON(): Readonly<ExpenseCardProps> {
    return { ...this.props };
  }
}
