/**
 * PgCategoryRepository — CategoryRepository PG implementasyonu.
 * Tablo: categories (003_categories_and_cells.sql).
 */
import type {
  CategoryRepository,
  NewCategoryInput,
} from '../../application/ports/CategoryRepository.js';
import { Category } from '../../domain/entities/Category.js';
import type { CategorySection } from '../../domain/valueObjects/CategorySection.js';

import type { Queryable } from './Queryable.js';

interface CategoryRow {
  id: number;
  company_id: number;
  section: CategorySection;
  name: string;
  sort_order: number;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

// NOT: `active` kolonu Faz 5 / PR 6c migration'ı (015) ile eklenir
// (kategori arşivleme). Bu repo o kolonu bekler.
const COLS = 'id, company_id, section, name, sort_order, active, created_at, updated_at';

export class PgCategoryRepository implements CategoryRepository {
  constructor(private readonly db: Queryable) {}

  async insert(input: NewCategoryInput): Promise<Category> {
    const r = await this.db.query<CategoryRow>(
      `INSERT INTO categories (company_id, section, name, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING ${COLS}`,
      [input.companyId, input.section, input.name, input.sortOrder],
    );
    return rowToCategory(r.rows[0]!);
  }

  async update(category: Category): Promise<void> {
    await this.db.query(
      `UPDATE categories
         SET name = $1, sort_order = $2, active = $3, updated_at = NOW()
       WHERE id = $4 AND company_id = $5`,
      [category.name, category.sortOrder, category.active, category.id, category.companyId],
    );
  }

  async findById(id: number, companyId: number): Promise<Category | null> {
    const r = await this.db.query<CategoryRow>(
      `SELECT ${COLS} FROM categories WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToCategory(row) : null;
  }

  async listByCompany(
    companyId: number,
    options?: { section?: CategorySection; includeArchived?: boolean },
  ): Promise<ReadonlyArray<Category>> {
    const conditions: string[] = ['company_id = $1'];
    const params: unknown[] = [companyId];
    if (options?.section !== undefined) {
      params.push(options.section);
      conditions.push(`section = $${params.length}`);
    }
    if (options?.includeArchived !== true) {
      conditions.push('active = TRUE');
    }
    const r = await this.db.query<CategoryRow>(
      `SELECT ${COLS} FROM categories
        WHERE ${conditions.join(' AND ')}
        ORDER BY section ASC, sort_order ASC, id ASC`,
      params,
    );
    return r.rows.map(rowToCategory);
  }

  async existsByName(
    companyId: number,
    section: CategorySection,
    name: string,
    excludeId?: number,
  ): Promise<boolean> {
    const params: unknown[] = [companyId, section, name];
    let sql = `SELECT EXISTS(
       SELECT 1 FROM categories
        WHERE company_id = $1 AND section = $2 AND LOWER(name) = LOWER($3)`;
    if (excludeId !== undefined) {
      params.push(excludeId);
      sql += ` AND id <> $${params.length}`;
    }
    sql += ') AS exists';
    const r = await this.db.query<{ exists: boolean }>(sql, params);
    return r.rows[0]?.exists ?? false;
  }
}

function rowToCategory(row: CategoryRow): Category {
  return Category.create({
    id: row.id,
    companyId: row.company_id,
    section: row.section,
    name: row.name,
    sortOrder: row.sort_order,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
