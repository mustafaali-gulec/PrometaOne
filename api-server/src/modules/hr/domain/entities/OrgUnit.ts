/**
 * OrgUnit — şirket altı organizasyon birimi (recursive ağaç düğümü).
 *
 * Immutable. `rename`, `setParent`, `archive` gibi davranışlar yeni
 * instance döner. Domain saf TS — DB veya framework bilgisi yok.
 *
 * Ağaç davranışları (`isAncestorOf`, `descendantsOf`) saf graph işlemleridir
 * ve `OrgUnit`'ler arasında ID referansıyla çalışır.
 */
import type { OrgUnitCode } from '../valueObjects/OrgUnitCode.js';

export interface OrgUnitProps {
  id: number;
  companyId: number;
  parentId: number | null;
  name: string;
  code: OrgUnitCode | null;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class OrgUnit {
  private constructor(private readonly props: Readonly<OrgUnitProps>) {}

  static create(props: OrgUnitProps): OrgUnit {
    if (props.id <= 0) {
      throw new Error('OrgUnit.id pozitif olmalı');
    }
    if (props.companyId <= 0) {
      throw new Error('OrgUnit.companyId pozitif olmalı');
    }
    if (props.parentId !== null && props.parentId === props.id) {
      throw new Error('OrgUnit.parentId kendi id ile aynı olamaz');
    }
    if (props.parentId !== null && props.parentId <= 0) {
      throw new Error('OrgUnit.parentId pozitif olmalı veya null');
    }
    if (props.name.trim().length === 0) {
      throw new Error('OrgUnit.name boş olamaz');
    }
    if (props.name.length > 200) {
      throw new Error('OrgUnit.name 200 karakteri geçemez');
    }
    if (!Number.isInteger(props.sortOrder)) {
      throw new Error('OrgUnit.sortOrder tam sayı olmalı');
    }
    return new OrgUnit(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get parentId(): number | null {
    return this.props.parentId;
  }
  get name(): string {
    return this.props.name;
  }
  get code(): OrgUnitCode | null {
    return this.props.code;
  }
  get sortOrder(): number {
    return this.props.sortOrder;
  }
  get active(): boolean {
    return this.props.active;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Root mu? (parentId === null) */
  isRoot(): boolean {
    return this.props.parentId === null;
  }

  /** Adı değiştirir — yeni instance döner. */
  rename(newName: string, now: Date): OrgUnit {
    const trimmed = newName.trim();
    if (trimmed.length === 0) {
      throw new Error('OrgUnit.name boş olamaz');
    }
    if (trimmed.length > 200) {
      throw new Error('OrgUnit.name 200 karakteri geçemez');
    }
    if (trimmed === this.props.name) {
      return this;
    }
    return new OrgUnit({ ...this.props, name: trimmed, updatedAt: now });
  }

  /** Parent'ı değiştirir — yeni instance döner. Cycle check yapmaz (use-case yapar). */
  setParent(newParentId: number | null, now: Date): OrgUnit {
    if (newParentId !== null && newParentId === this.props.id) {
      throw new Error('OrgUnit.parentId kendi id ile aynı olamaz');
    }
    if (newParentId !== null && newParentId <= 0) {
      throw new Error('OrgUnit.parentId pozitif olmalı veya null');
    }
    if (newParentId === this.props.parentId) {
      return this;
    }
    return new OrgUnit({ ...this.props, parentId: newParentId, updatedAt: now });
  }

  /** Arşivler (active=false) — yeni instance döner. */
  archive(now: Date): OrgUnit {
    if (!this.props.active) {
      return this;
    }
    return new OrgUnit({ ...this.props, active: false, updatedAt: now });
  }

  /** Yeniden aktifleştirir — yeni instance döner. */
  reactivate(now: Date): OrgUnit {
    if (this.props.active) {
      return this;
    }
    return new OrgUnit({ ...this.props, active: true, updatedAt: now });
  }

  toJSON(): Readonly<OrgUnitProps> {
    return { ...this.props };
  }
}
