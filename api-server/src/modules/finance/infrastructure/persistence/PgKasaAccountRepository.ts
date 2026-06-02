/**
 * PgKasaAccountRepository — KasaAccountRepository PG implementasyonu.
 * Tablo: kasa_accounts (004).
 */
import type {
  KasaAccountRepository,
  NewKasaAccountInput,
} from '../../application/ports/CashRepositories.js';
import { KasaAccount } from '../../domain/entities/KasaAccount.js';
import { toCurrency, type Currency } from '../../domain/valueObjects/Currency.js';
import { Money } from '../../domain/valueObjects/Money.js';

import type { Queryable } from './Queryable.js';

interface KasaAccountRow {
  id: number;
  company_id: number;
  name: string;
  currency: Currency;
  opening_balance: string;
  active: boolean;
}

const COLS = 'id, company_id, name, currency, opening_balance, active';

export class PgKasaAccountRepository implements KasaAccountRepository {
  constructor(private readonly db: Queryable) {}

  async insert(input: NewKasaAccountInput): Promise<KasaAccount> {
    const r = await this.db.query<KasaAccountRow>(
      `INSERT INTO kasa_accounts (company_id, name, currency, opening_balance)
       VALUES ($1, $2, $3, $4)
       RETURNING ${COLS}`,
      [input.companyId, input.name, input.currency, input.openingBalanceMajor.toFixed(2)],
    );
    return rowToKasaAccount(r.rows[0]!);
  }

  async update(account: KasaAccount): Promise<void> {
    await this.db.query(
      `UPDATE kasa_accounts SET name = $1, active = $2, updated_at = NOW()
       WHERE id = $3 AND company_id = $4`,
      [account.name, account.active, account.id, account.companyId],
    );
  }

  async findById(id: number, companyId: number): Promise<KasaAccount | null> {
    const r = await this.db.query<KasaAccountRow>(
      `SELECT ${COLS} FROM kasa_accounts WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToKasaAccount(row) : null;
  }

  async listByCompany(
    companyId: number,
    options?: { includeArchived?: boolean },
  ): Promise<ReadonlyArray<KasaAccount>> {
    const conditions = ['company_id = $1'];
    if (options?.includeArchived !== true) {
      conditions.push('active = TRUE');
    }
    const r = await this.db.query<KasaAccountRow>(
      `SELECT ${COLS} FROM kasa_accounts
        WHERE ${conditions.join(' AND ')} ORDER BY name ASC, id ASC`,
      [companyId],
    );
    return r.rows.map(rowToKasaAccount);
  }
}

function rowToKasaAccount(row: KasaAccountRow): KasaAccount {
  const currency = toCurrency(row.currency);
  return KasaAccount.create({
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    currency,
    openingBalance: Money.fromDecimalString(row.opening_balance, currency),
    active: row.active,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
