/**
 * PgExpenseCardRepository — ExpenseCardRepository PG implementasyonu.
 * Tablo: expense_cards (030_expense_cards.sql).
 *
 * Kod otomatik üretimi: insert sırasında code boşsa, şirket bazında en yüksek
 * GK000n numarasından bir sonrakini üretir (GK0001, GK0002...).
 */
import type {
  ExpenseCardRepository,
  ListExpenseCardsOptions,
  NewExpenseCardInput,
} from '../../application/ports/ExpenseCardRepository.js';
import type { ExpenseCardAttributes, FlowDirection } from '../../domain/entities/ExpenseCard.js';
import { ExpenseCard } from '../../domain/entities/ExpenseCard.js';

import type { Queryable } from './Queryable.js';

interface ExpenseCardRow {
  id: number;
  company_id: number;
  code: string;
  name: string;
  category: string;
  direction: FlowDirection;
  default_account_code: string | null;
  note: string | null;
  attributes: ExpenseCardAttributes | null;
  active: boolean;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

const COLS =
  'id, company_id, code, name, category, direction, default_account_code, note, attributes, active, created_by, created_at, updated_at';

const CODE_PREFIX = 'GK';

export class PgExpenseCardRepository implements ExpenseCardRepository {
  constructor(private readonly db: Queryable) {}

  async insert(input: NewExpenseCardInput): Promise<ExpenseCard> {
    const code = input.code.trim() || (await this.nextCode(input.companyId));
    const r = await this.db.query<ExpenseCardRow>(
      `INSERT INTO expense_cards
         (company_id, code, name, category, direction, default_account_code, note, attributes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
       RETURNING ${COLS}`,
      [
        input.companyId,
        code,
        input.name,
        input.category,
        input.direction,
        input.defaultAccountCode,
        input.note,
        JSON.stringify(input.attributes ?? {}),
        input.createdBy,
      ],
    );
    return rowToExpenseCard(r.rows[0]!);
  }

  async update(card: ExpenseCard): Promise<void> {
    await this.db.query(
      `UPDATE expense_cards
         SET name = $1, category = $2, direction = $3, default_account_code = $4,
             note = $5, attributes = $6::jsonb, active = $7, updated_at = NOW()
       WHERE id = $8 AND company_id = $9`,
      [
        card.name,
        card.category,
        card.direction,
        card.defaultAccountCode,
        card.note,
        JSON.stringify(card.attributes ?? {}),
        card.active,
        card.id,
        card.companyId,
      ],
    );
  }

  async findById(id: number, companyId: number): Promise<ExpenseCard | null> {
    const r = await this.db.query<ExpenseCardRow>(
      `SELECT ${COLS} FROM expense_cards WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToExpenseCard(row) : null;
  }

  async findByCode(code: string, companyId: number): Promise<ExpenseCard | null> {
    const r = await this.db.query<ExpenseCardRow>(
      `SELECT ${COLS} FROM expense_cards WHERE code = $1 AND company_id = $2 LIMIT 1`,
      [code, companyId],
    );
    const row = r.rows[0];
    return row ? rowToExpenseCard(row) : null;
  }

  async list(options: ListExpenseCardsOptions): Promise<ReadonlyArray<ExpenseCard>> {
    const conditions: string[] = ['company_id = $1'];
    const params: unknown[] = [options.companyId];
    if (options.includeInactive !== true) {
      conditions.push('active = TRUE');
    }
    if (options.search) {
      params.push(`%${options.search}%`);
      conditions.push(
        `(name ILIKE $${params.length} OR code ILIKE $${params.length} OR category ILIKE $${params.length})`,
      );
    }
    const r = await this.db.query<ExpenseCardRow>(
      `SELECT ${COLS} FROM expense_cards
        WHERE ${conditions.join(' AND ')}
        ORDER BY name ASC, id ASC`,
      params,
    );
    return r.rows.map(rowToExpenseCard);
  }

  /** Şirket bazında en yüksek GK000n kodundan bir sonrakini üretir. */
  private async nextCode(companyId: number): Promise<string> {
    const r = await this.db.query<{ code: string }>(
      `SELECT code FROM expense_cards WHERE company_id = $1 AND code ~ '^GK[0-9]+$'`,
      [companyId],
    );
    let max = 0;
    for (const row of r.rows) {
      const m = /^GK0*(\d+)$/i.exec(row.code.trim());
      if (m) {
        const n = parseInt(m[1]!, 10);
        if (!Number.isNaN(n) && n > max) max = n;
      }
    }
    return `${CODE_PREFIX}${String(max + 1).padStart(4, '0')}`;
  }
}

function rowToExpenseCard(row: ExpenseCardRow): ExpenseCard {
  return ExpenseCard.create({
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    category: row.category,
    direction: row.direction,
    defaultAccountCode: row.default_account_code,
    note: row.note,
    attributes: row.attributes ?? {},
    active: row.active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
