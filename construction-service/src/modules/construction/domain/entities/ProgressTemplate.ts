/**
 * ProgressTemplate — fiziksel ilerleme takip şablonu (şirket katmanı).
 * Tablolar: cs_progress_templates / _groups / _items (006_physical_progress.sql).
 *
 * Şablon bir ağırlık iskeletidir:
 *   Şablon
 *     └─ İş Grubu (weightPct = "İ.G. Oran")
 *          └─ İş   (weightPct = "İ. Oran")
 *
 * AĞIRLIK KURALI: grup ağırlıkları şablon içinde, iş ağırlıkları da kendi grubu
 * içinde 100'e tümlenmelidir. Kural burada ZORLAYICI DEĞİL, ÖLÇÜLÜR
 * (weightIssues()): şablon kurulurken kullanıcı ara adımlarda 100'ü tutmaz ve
 * kaydı bloke etmek veri girişini işkenceye çevirir. Bunun yerine tutarsızlık
 * arayüze uyarı olarak taşınır; rollup zaten ağırlık toplamına normalize eder
 * (bkz. ItemState.rollupWeighted), yani yanlış toplam sonucu bozmaz — sadece
 * kullanıcının niyetiyle uyuşmaz.
 */
import { ConstructionValidationError } from '../errors/ConstructionErrors.js';
import type { TrackScope } from '../valueObjects/TrackingStatus.js';

/** Ağırlık toplamı bu toleransla 100 kabul edilir (NUMERIC(9,4) yuvarlaması). */
export const WEIGHT_TOLERANCE = 0.0001;

export interface TemplateItemProps {
  id: number;
  companyId: number;
  groupId: number;
  code: string;
  name: string;
  weightPct: number;
  sortOrder: number;
  pozId: number | null;
}

export interface TemplateGroupProps {
  id: number;
  companyId: number;
  templateId: number;
  code: string;
  name: string;
  weightPct: number;
  sortOrder: number;
  items: ReadonlyArray<TemplateItemProps>;
}

export interface ProgressTemplateProps {
  id: number;
  companyId: number;
  code: string;
  name: string;
  scope: TrackScope;
  description: string | null;
  pctInProgress: number;
  pctHasDefects: number;
  active: boolean;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
  groups: ReadonlyArray<TemplateGroupProps>;
}

export interface ProgressTemplateUpdate {
  name?: string;
  scope?: TrackScope;
  description?: string | null;
  pctInProgress?: number;
  pctHasDefects?: number;
}

/** Ağırlık tutarsızlığı raporu — arayüz uyarı olarak gösterir. */
export interface WeightIssue {
  level: 'template' | 'group';
  /** level='group' ise grubun id'si */
  groupId?: number;
  groupName?: string;
  sum: number;
}

function assertPct(v: number, label: string): number {
  if (!Number.isFinite(v) || v < 0 || v > 100) {
    throw new ConstructionValidationError(`${label} 0-100 aralığında olmalı`);
  }
  return v;
}

function assertText(v: string, label: string, max: number): string {
  const t = v.trim();
  if (t.length === 0) throw new ConstructionValidationError(`${label} boş olamaz`);
  if (t.length > max) throw new ConstructionValidationError(`${label} ${max} karakteri geçemez`);
  return t;
}

export class ProgressTemplate {
  private constructor(private readonly props: Readonly<ProgressTemplateProps>) {}

  static create(props: ProgressTemplateProps): ProgressTemplate {
    if (props.id <= 0) throw new ConstructionValidationError('ProgressTemplate.id pozitif olmalı');
    if (props.companyId <= 0)
      throw new ConstructionValidationError('ProgressTemplate.companyId pozitif olmalı');
    return new ProgressTemplate({
      ...props,
      code: assertText(props.code, 'şablon kodu', 40),
      name: assertText(props.name, 'şablon adı', 300),
      pctInProgress: assertPct(props.pctInProgress, "'devam ediyor' yüzdesi"),
      pctHasDefects: assertPct(props.pctHasDefects, "'eksikleri var' yüzdesi"),
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
  get scope(): TrackScope {
    return this.props.scope;
  }
  get description(): string | null {
    return this.props.description;
  }
  get pctInProgress(): number {
    return this.props.pctInProgress;
  }
  get pctHasDefects(): number {
    return this.props.pctHasDefects;
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
  get groups(): ReadonlyArray<TemplateGroupProps> {
    return this.props.groups;
  }

  /** Şablondaki toplam iş kalemi sayısı — takip materyalizasyonunda kaç satır üretilecek. */
  get itemCount(): number {
    return this.props.groups.reduce((n, g) => n + g.items.length, 0);
  }

  /**
   * Ağırlık tutarsızlıkları. Boş dizi = şablon tutarlı.
   * Kalem içermeyen gruplar raporlanmaz (henüz doldurulmamış grup hata değildir).
   */
  weightIssues(): ReadonlyArray<WeightIssue> {
    const issues: WeightIssue[] = [];
    const groupSum = this.props.groups.reduce((s, g) => s + g.weightPct, 0);
    if (this.props.groups.length > 0 && Math.abs(groupSum - 100) > WEIGHT_TOLERANCE) {
      issues.push({ level: 'template', sum: groupSum });
    }
    for (const g of this.props.groups) {
      if (g.items.length === 0) continue;
      const itemSum = g.items.reduce((s, i) => s + i.weightPct, 0);
      if (Math.abs(itemSum - 100) > WEIGHT_TOLERANCE) {
        issues.push({ level: 'group', groupId: g.id, groupName: g.name, sum: itemSum });
      }
    }
    return issues;
  }

  update(changes: ProgressTemplateUpdate, now: Date): ProgressTemplate {
    return new ProgressTemplate({
      ...this.props,
      name:
        changes.name !== undefined ? assertText(changes.name, 'şablon adı', 300) : this.props.name,
      scope: changes.scope ?? this.props.scope,
      description:
        changes.description !== undefined
          ? changes.description?.trim() || null
          : this.props.description,
      pctInProgress:
        changes.pctInProgress !== undefined
          ? assertPct(changes.pctInProgress, "'devam ediyor' yüzdesi")
          : this.props.pctInProgress,
      pctHasDefects:
        changes.pctHasDefects !== undefined
          ? assertPct(changes.pctHasDefects, "'eksikleri var' yüzdesi")
          : this.props.pctHasDefects,
      updatedAt: now,
    });
  }

  deactivate(now: Date): ProgressTemplate {
    if (!this.props.active) return this;
    return new ProgressTemplate({ ...this.props, active: false, updatedAt: now });
  }

  toJSON(): Readonly<ProgressTemplateProps> {
    return { ...this.props };
  }
}
