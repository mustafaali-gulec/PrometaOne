/**
 * Category — nakit akış kategorisi (003_categories_and_cells.sql).
 *
 * Bir kategori bir `section`'a aittir (inflows/outflows/nonPnlOutflows/
 * kasaCategories) ve şirket içinde (section bazında) benzersiz isimlidir.
 * `sortOrder` matris içindeki satır sırasını belirler.
 *
 * Immutable — rename/reorder/archive yeni instance döner.
 */
import type { CategorySection } from '../valueObjects/CategorySection.js';

export interface CategoryProps {
  id: number;
  companyId: number;
  section: CategorySection;
  name: string;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Category {
  private constructor(private readonly props: Readonly<CategoryProps>) {}

  static create(props: CategoryProps): Category {
    if (props.id <= 0) {
      throw new Error('Category.id pozitif olmalı');
    }
    if (props.companyId <= 0) {
      throw new Error('Category.companyId pozitif olmalı');
    }
    if (props.name.trim().length === 0) {
      throw new Error('Category.name boş olamaz');
    }
    if (props.name.length > 200) {
      throw new Error('Category.name 200 karakteri geçemez');
    }
    if (!Number.isInteger(props.sortOrder)) {
      throw new Error('Category.sortOrder tam sayı olmalı');
    }
    return new Category(props);
  }

  get id(): number {
    return this.props.id;
  }
  get companyId(): number {
    return this.props.companyId;
  }
  get section(): CategorySection {
    return this.props.section;
  }
  get name(): string {
    return this.props.name;
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

  rename(newName: string, now: Date): Category {
    const trimmed = newName.trim();
    if (trimmed.length === 0) {
      throw new Error('Category.name boş olamaz');
    }
    if (trimmed.length > 200) {
      throw new Error('Category.name 200 karakteri geçemez');
    }
    if (trimmed === this.props.name) {
      return this;
    }
    return new Category({ ...this.props, name: trimmed, updatedAt: now });
  }

  reorder(sortOrder: number, now: Date): Category {
    if (!Number.isInteger(sortOrder)) {
      throw new Error('Category.sortOrder tam sayı olmalı');
    }
    if (sortOrder === this.props.sortOrder) {
      return this;
    }
    return new Category({ ...this.props, sortOrder, updatedAt: now });
  }

  archive(now: Date): Category {
    if (!this.props.active) {
      return this;
    }
    return new Category({ ...this.props, active: false, updatedAt: now });
  }

  reactivate(now: Date): Category {
    if (this.props.active) {
      return this;
    }
    return new Category({ ...this.props, active: true, updatedAt: now });
  }

  toJSON(): Readonly<CategoryProps> {
    return { ...this.props };
  }
}
