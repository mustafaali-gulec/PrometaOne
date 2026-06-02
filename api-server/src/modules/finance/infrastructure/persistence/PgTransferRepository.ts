/**
 * PgTransferRepository — TransferRepository PG implementasyonu.
 * Tablo: transfers (004). from/to ayrı currency + amount.
 */
import type { TransferRepository } from '../../application/ports/CashRepositories.js';
import { Transfer } from '../../domain/entities/Transfer.js';
import { toCurrency, type Currency } from '../../domain/valueObjects/Currency.js';
import type { EndpointType } from '../../domain/valueObjects/EndpointType.js';
import { Money } from '../../domain/valueObjects/Money.js';

import type { Queryable } from './Queryable.js';

interface TransferRow {
  id: number;
  company_id: number;
  date: string;
  from_type: EndpointType;
  from_id: number;
  to_type: EndpointType;
  to_id: number;
  from_amount: string;
  to_amount: string;
  from_currency: Currency;
  to_currency: Currency;
  description: string | null;
  cashflow_cat_id: number | null;
  committed_to_cells: boolean;
  committed_at: Date | null;
  created_by: number | null;
}

const SELECT = `SELECT id, company_id, to_char(date, 'YYYY-MM-DD') AS date, from_type, from_id, to_type, to_id,
          from_amount, to_amount, from_currency, to_currency, description,
          cashflow_cat_id, committed_to_cells, committed_at, created_by
     FROM transfers`;

export class PgTransferRepository implements TransferRepository {
  constructor(private readonly db: Queryable) {}

  async insert(transfer: Transfer): Promise<Transfer> {
    const r = await this.db.query<{ id: number }>(
      `INSERT INTO transfers
         (company_id, date, from_type, from_id, to_type, to_id, from_amount, to_amount,
          from_currency, to_currency, description, cashflow_cat_id, committed_to_cells, committed_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id`,
      [
        transfer.companyId,
        transfer.date,
        transfer.fromType,
        transfer.fromId,
        transfer.toType,
        transfer.toId,
        transfer.fromAmount.toDecimalString(),
        transfer.toAmount.toDecimalString(),
        transfer.fromAmount.currency,
        transfer.toAmount.currency,
        transfer.description,
        transfer.cashflowCatId,
        transfer.committedToCells,
        transfer.committedAt,
        transfer.createdBy,
      ],
    );
    return transfer.withId(r.rows[0]!.id);
  }

  async update(transfer: Transfer): Promise<void> {
    await this.db.query(
      `UPDATE transfers
         SET cashflow_cat_id = $1, committed_to_cells = $2, committed_at = $3, updated_at = NOW()
       WHERE id = $4 AND company_id = $5`,
      [
        transfer.cashflowCatId,
        transfer.committedToCells,
        transfer.committedAt,
        transfer.id,
        transfer.companyId,
      ],
    );
  }

  async findById(id: number, companyId: number): Promise<Transfer | null> {
    const r = await this.db.query<TransferRow>(
      `${SELECT} WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToTransfer(row) : null;
  }

  async listByCompany(companyId: number): Promise<ReadonlyArray<Transfer>> {
    const r = await this.db.query<TransferRow>(
      `${SELECT} WHERE company_id = $1 ORDER BY date DESC, id DESC`,
      [companyId],
    );
    return r.rows.map(rowToTransfer);
  }

  async listIncoming(
    companyId: number,
    toType: EndpointType,
    toId: number,
  ): Promise<ReadonlyArray<Transfer>> {
    const r = await this.db.query<TransferRow>(
      `${SELECT} WHERE company_id = $1 AND to_type = $2 AND to_id = $3`,
      [companyId, toType, toId],
    );
    return r.rows.map(rowToTransfer);
  }

  async listOutgoing(
    companyId: number,
    fromType: EndpointType,
    fromId: number,
  ): Promise<ReadonlyArray<Transfer>> {
    const r = await this.db.query<TransferRow>(
      `${SELECT} WHERE company_id = $1 AND from_type = $2 AND from_id = $3`,
      [companyId, fromType, fromId],
    );
    return r.rows.map(rowToTransfer);
  }
}

function rowToTransfer(row: TransferRow): Transfer {
  return Transfer.create({
    id: row.id,
    companyId: row.company_id,
    date: row.date,
    fromType: row.from_type,
    fromId: row.from_id,
    toType: row.to_type,
    toId: row.to_id,
    fromAmount: Money.fromDecimalString(row.from_amount, toCurrency(row.from_currency)),
    toAmount: Money.fromDecimalString(row.to_amount, toCurrency(row.to_currency)),
    description: row.description,
    cashflowCatId: row.cashflow_cat_id,
    committedToCells: row.committed_to_cells,
    committedAt: row.committed_at,
    createdBy: row.created_by,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
