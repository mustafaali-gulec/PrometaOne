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

/**
 * Gider kartının ek öznitelikleri — sekmeli editörün "Muhasebe & Vergi" ve
 * "Bütçe & Varsayılanlar" sekmelerini besler. Tümü opsiyonel; JSONB `attributes`
 * kolonunda tutulur (039_expense_card_attributes.sql). Bilinmeyen anahtarlar
 * REST sınırında (zod) elenir.
 */
export interface ExpenseCardAttributes {
  kdvRate?: number | undefined; // KDV oranı (%)
  tevkifatCode?: string | undefined; // Tevkifat kodu (örn. 9/10)
  taxDeductible?: boolean | undefined; // Kanunen kabul edilen gider mi (KKEG değil)
  costCenter?: string | undefined; // Masraf merkezi / proje
  paymentMethod?: string | undefined; // 'cash' | 'card' | 'transfer' | ''
  currency?: string | undefined; // TRY | USD | EUR ...
  defaultAmount?: number | undefined; // Varsayılan tutar
  monthlyBudget?: number | undefined; // Aylık bütçe limiti
  recurring?: boolean | undefined; // Düzenli / tekrarlayan gider
  vendor?: string | undefined; // Varsayılan tedarikçi / cari adı
}

export interface ExpenseCardProps {
  id: number;
  companyId: number;
  code: string;
  name: string;
  category: string;
  direction: FlowDirection;
  defaultAccountCode: string | null;
  note: string | null;
  attributes: ExpenseCardAttributes;
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
  attributes?: ExpenseCardAttributes;
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
    return new ExpenseCard({
      ...props,
      category: props.category.trim(),
      attributes: props.attributes ?? {},
    });
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
  get attributes(): ExpenseCardAttributes {
    return this.props.attributes;
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
      attributes: changes.attributes !== undefined ? changes.attributes : this.props.attributes,
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
