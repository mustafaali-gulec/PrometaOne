/**
 * PgBankAccountRepository — BankAccountRepository PG implementasyonu.
 * Tablo: bank_accounts (004).
 */
import type {
  BankAccountRepository,
  NewBankAccountInput,
} from '../../application/ports/CashRepositories.js';
import { BankAccount } from '../../domain/entities/BankAccount.js';
import { toCurrency, type Currency } from '../../domain/valueObjects/Currency.js';
import { Money } from '../../domain/valueObjects/Money.js';

import type { Queryable } from './Queryable.js';

interface BankAccountRow {
  id: number;
  company_id: number;
  bank_id: number;
  name: string;
  iban: string | null;
  account_no: string | null;
  currency: Currency;
  opening_balance: string;
  cashflow_cat_id: number | null;
  active: boolean;
}

const COLS =
  'id, company_id, bank_id, name, iban, account_no, currency, ' +
  'opening_balance, cashflow_cat_id, active';

export class PgBankAccountRepository implements BankAccountRepository {
  constructor(private readonly db: Queryable) {}

  async insert(input: NewBankAccountInput): Promise<BankAccount> {
    const r = await this.db.query<BankAccountRow>(
      `INSERT INTO bank_accounts
         (company_id, bank_id, name, iban, account_no, currency, opening_balance, cashflow_cat_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${COLS}`,
      [
        input.companyId,
        input.bankId,
        input.name,
        input.iban,
        input.accountNo,
        input.currency,
        input.openingBalanceMajor.toFixed(2),
        input.cashflowCatId,
      ],
    );
    return rowToBankAccount(r.rows[0]!);
  }

  async update(account: BankAccount): Promise<void> {
    await this.db.query(
      `UPDATE bank_accounts
         SET name = $1, iban = $2, account_no = $3, cashflow_cat_id = $4,
             active = $5, updated_at = NOW()
       WHERE id = $6 AND company_id = $7`,
      [
        account.name,
        account.iban,
        account.accountNo,
        account.cashflowCatId,
        account.active,
        account.id,
        account.companyId,
      ],
    );
  }

  async findById(id: number, companyId: number): Promise<BankAccount | null> {
    const r = await this.db.query<BankAccountRow>(
      `SELECT ${COLS} FROM bank_accounts WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToBankAccount(row) : null;
  }

  async listByCompany(
    companyId: number,
    options?: { includeArchived?: boolean },
  ): Promise<ReadonlyArray<BankAccount>> {
    const conditions = ['company_id = $1'];
    if (options?.includeArchived !== true) {
      conditions.push('active = TRUE');
    }
    const r = await this.db.query<BankAccountRow>(
      `SELECT ${COLS} FROM bank_accounts
        WHERE ${conditions.join(' AND ')} ORDER BY name ASC, id ASC`,
      [companyId],
    );
    return r.rows.map(rowToBankAccount);
  }
}

function rowToBankAccount(row: BankAccountRow): BankAccount {
  const currency = toCurrency(row.currency);
  return BankAccount.create({
    id: row.id,
    companyId: row.company_id,
    bankId: row.bank_id,
    name: row.name,
    iban: row.iban,
    accountNo: row.account_no,
    currency,
    openingBalance: Money.fromDecimalString(row.opening_balance, currency),
    cashflowCatId: row.cashflow_cat_id,
    active: row.active,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
