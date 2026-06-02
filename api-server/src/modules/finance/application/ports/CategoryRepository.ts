/**
 * CategoryRepository — kategori kalıcılık portu.
 *
 * Concrete: infrastructure/persistence/PgCategoryRepository.ts (PR 6).
 */
import type { Category } from '../../domain/entities/Category.js';
import type { CategorySection } from '../../domain/valueObjects/CategorySection.js';

export interface NewCategoryInput {
  companyId: number;
  section: CategorySection;
  name: string;
  sortOrder: number;
}

export interface CategoryRepository {
  insert(input: NewCategoryInput): Promise<Category>;
  update(category: Category): Promise<void>;
  findById(id: number, companyId: number): Promise<Category | null>;
  /** section verilmezse tümü; varsayılan yalnız aktifler (includeArchived ile genişler). */
  listByCompany(
    companyId: number,
    options?: { section?: CategorySection; includeArchived?: boolean },
  ): Promise<ReadonlyArray<Category>>;
  /**
   * Aynı şirket + section'da verilen isimde kategori var mı?
   * excludeId — güncelleme sırasında kendi kaydını hariç tutmak için.
   */
  existsByName(
    companyId: number,
    section: CategorySection,
    name: string,
    excludeId?: number,
  ): Promise<boolean>;
}
