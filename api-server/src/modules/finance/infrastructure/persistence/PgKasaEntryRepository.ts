/**
 * PgKasaEntryRepository — KasaEntryRepository PG implementasyonu.
 * Tablo: kasa_entries (004).
 *
 * NOT: kasa_entries'te currency kolonu yok; tutarın para birimi bağlı
 * kasa hesabınınkidir. Okurken kasa_accounts JOIN ile currency alınır.
 */
import type { KasaEntryRepository } from '../../application/ports/CashRepositories.js';
import { KasaEntry } from '../../domain/entities/KasaEntry.js';
import { toCurrency, type Currency } from '../../domain/valueObjects/Currency.js';
import type { FlowDirection } from '../../domain/valueObjects/FlowDirection.js';
import { Money } from '../../domain/valueObjects/Money.js';

import type { Queryable } from './Queryable.js';

interface KasaEntryRow {
  id: number;
  kasa_account_id: number;
  date: string;
  type: FlowDirection;
  amount: string;
  description: string | null;
  category: string | null;
  cashflow_cat_id: number | null;
  committed_to_cells: boolean;
  committed_at: Date | null;
  created_by: number | null;
  currency: Currency; // JOIN kasa_accounts
}

const SELECT = `SELECT e.id, e.kasa_account_id, to_char(e.date, 'YYYY-MM-DD') AS date, e.type, e.amount,
          e.description, e.category, e.cashflow_cat_id, e.committed_to_cells, e.committed_at,
          e.created_by, ka.currency
     FROM kasa_entries e
     JOIN kasa_accounts ka ON ka.id = e.kasa_account_id`;

export class PgKasaEntryRepository implements KasaEntryRepository {
  constructor(private readonly db: Queryable) {}

  async insert(entry: KasaEntry): Promise<KasaEntry> {
    const r = await this.db.query<{ id: number }>(
      `INSERT INTO kasa_entries
         (kasa_account_id, date, type, amount, description, category,
          cashflow_cat_id, committed_to_cells, committed_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        entry.kasaAccountId,
        entry.date,
        entry.type,
        entry.amount.toDecimalString(),
        entry.description,
        entry.category,
        entry.cashflowCatId,
        entry.committedToCells,
        entry.committedAt,
        entry.createdBy,
      ],
    );
    return entry.withId(r.rows[0]!.id);
  }

  async update(entry: KasaEntry): Promise<void> {
    await this.db.query(
      `UPDATE kasa_entries
         SET kasa_account_id = $1, date = $2, type = $3, amount = $4,
             description = $5, category = $6, cashflow_cat_id = $7,
             committed_to_cells = $8, committed_at = $9, updated_at = NOW()
       WHERE id = $10`,
      [
        entry.kasaAccountId,
        entry.date,
        entry.type,
        entry.amount.toDecimalString(),
        entry.description,
        entry.category,
        entry.cashflowCatId,
        entry.committedToCells,
        entry.committedAt,
        entry.id,
      ],
    );
  }

  async findById(id: number): Promise<KasaEntry | null> {
    const r = await this.db.query<KasaEntryRow>(`${SELECT} WHERE e.id = $1 LIMIT 1`, [id]);
    const row = r.rows[0];
    return row ? rowToKasaEntry(row) : null;
  }

  async listByAccount(kasaAccountId: number): Promise<ReadonlyArray<KasaEntry>> {
    const r = await this.db.query<KasaEntryRow>(
      `${SELECT} WHERE e.kasa_account_id = $1 ORDER BY e.date DESC, e.id DESC`,
      [kasaAccountId],
    );
    return r.rows.map(rowToKasaEntry);
  }

  async listByCompany(companyId: number): Promise<ReadonlyArray<KasaEntry>> {
    const r = await this.db.query<KasaEntryRow>(
      `${SELECT} WHERE ka.company_id = $1 ORDER BY e.date DESC, e.id DESC`,
      [companyId],
    );
    return r.rows.map(rowToKasaEntry);
  }

  async delete(id: number): Promise<void> {
    await this.db.query('DELETE FROM kasa_entries WHERE id = $1', [id]);
  }
}

function rowToKasaEntry(row: KasaEntryRow): KasaEntry {
  return KasaEntry.create({
    id: row.id,
    kasaAccountId: row.kasa_account_id,
    date: row.date,
    type: row.type,
    amount: Money.fromDecimalString(row.amount, toCurrency(row.currency)),
    description: row.description,
    category: row.category,
    cashflowCatId: row.cashflow_cat_id,
    committedToCells: row.committed_to_cells,
    committedAt: row.committed_at,
    createdBy: row.created_by,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
