/**
 * PgContractRepository — ContractRepository PG implementasyonu.
 * Tablolar: cs_contracts (+ 1-1 cs_tender_info). Çok tablolu yazım transaction.
 *
 * Okuma: cs_tender_info LEFT JOIN ile gömülü tender üretilir. Yazım: tender !== null
 * ise upsert, null ise tender satırı silinir.
 */
import type { Pool, PoolClient } from 'pg';

import type {
  ContractRepository,
  ListContractsOptions,
  NewContractInput,
} from '../../application/ports/ContractRepository.js';
import { Contract, type TenderInfoProps } from '../../domain/entities/Contract.js';
import type { ContractParty } from '../../domain/valueObjects/ContractParty.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';

interface ContractRow {
  id: number;
  company_id: number;
  project_id: number;
  party_kind: ContractParty;
  vendor_id: number | null;
  contract_no: string;
  title: string;
  amount: string;
  currency: CurrencyCode;
  sign_date: string | null;
  start_date: string | null;
  end_date: string | null;
  retention_pct: string;
  advance_pct: string;
  price_diff_on: boolean;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
  // tender (LEFT JOIN; t_contract_id null ise tender yok)
  t_contract_id: number | null;
  t_ikn: string | null;
  t_procedure: string | null;
  t_approx_cost: string | null;
  t_tender_date: string | null;
  t_work_increase_pct: string | null;
  t_perf_bond_pct: string | null;
  t_notes: string | null;
}

const SELECT_SQL = `
  SELECT c.id, c.company_id, c.project_id, c.party_kind, c.vendor_id, c.contract_no, c.title,
         c.amount, c.currency, c.sign_date::text AS sign_date, c.start_date::text AS start_date,
         c.end_date::text AS end_date, c.retention_pct, c.advance_pct, c.price_diff_on,
         c.created_by, c.created_at, c.updated_at,
         ti.contract_id AS t_contract_id, ti.ikn AS t_ikn, ti.procedure AS t_procedure,
         ti.approx_cost AS t_approx_cost, ti.tender_date::text AS t_tender_date,
         ti.work_increase_pct AS t_work_increase_pct, ti.perf_bond_pct AS t_perf_bond_pct,
         ti.notes AS t_notes
    FROM cs_contracts c
    LEFT JOIN cs_tender_info ti ON ti.contract_id = c.id`;

export class PgContractRepository implements ContractRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewContractInput): Promise<Contract> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query<{ id: number }>(
        `INSERT INTO cs_contracts
           (company_id, project_id, party_kind, vendor_id, contract_no, title, amount, currency,
            sign_date, start_date, end_date, retention_pct, advance_pct, price_diff_on, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING id`,
        [
          input.companyId,
          input.projectId,
          input.partyKind,
          input.vendorId,
          input.contractNo,
          input.title,
          input.amount,
          input.currency,
          input.signDate,
          input.startDate,
          input.endDate,
          input.retentionPct,
          input.advancePct,
          input.priceDiffOn,
          input.createdBy,
        ],
      );
      const id = r.rows[0]!.id;
      if (input.tender !== null) {
        await upsertTender(client, id, input.tender);
      }
      await client.query('COMMIT');
      const created = await this.findById(id, input.companyId);
      if (!created) throw new Error('Contract insert sonrası okunamadı');
      return created;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async update(contract: Contract): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE cs_contracts
           SET vendor_id = $1, title = $2, amount = $3, currency = $4, sign_date = $5,
               start_date = $6, end_date = $7, retention_pct = $8, advance_pct = $9,
               price_diff_on = $10, updated_at = NOW()
         WHERE id = $11 AND company_id = $12`,
        [
          contract.vendorId,
          contract.title,
          contract.amount,
          contract.currency,
          contract.signDate,
          contract.startDate,
          contract.endDate,
          contract.retentionPct,
          contract.advancePct,
          contract.priceDiffOn,
          contract.id,
          contract.companyId,
        ],
      );
      if (contract.tender === null) {
        await client.query('DELETE FROM cs_tender_info WHERE contract_id = $1', [contract.id]);
      } else {
        await upsertTender(client, contract.id, contract.tender);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findById(id: number, companyId: number): Promise<Contract | null> {
    const r = await this.pool.query<ContractRow>(
      `${SELECT_SQL} WHERE c.id = $1 AND c.company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToContract(row) : null;
  }

  async listByCompany(
    companyId: number,
    options?: ListContractsOptions,
  ): Promise<ReadonlyArray<Contract>> {
    const conditions: string[] = ['c.company_id = $1'];
    const params: unknown[] = [companyId];
    if (options?.projectId !== undefined) {
      params.push(options.projectId);
      conditions.push(`c.project_id = $${params.length}`);
    }
    if (options?.partyKind) {
      params.push(options.partyKind);
      conditions.push(`c.party_kind = $${params.length}`);
    }
    if (options?.search) {
      params.push(`%${options.search}%`);
      conditions.push(`(c.title ILIKE $${params.length} OR c.contract_no ILIKE $${params.length})`);
    }
    const r = await this.pool.query<ContractRow>(
      `${SELECT_SQL} WHERE ${conditions.join(' AND ')} ORDER BY c.created_at DESC, c.id DESC`,
      params,
    );
    return r.rows.map(rowToContract);
  }

  async existsByNo(companyId: number, contractNo: string, excludeId?: number): Promise<boolean> {
    const params: unknown[] = [companyId, contractNo];
    let sql = `SELECT EXISTS(
       SELECT 1 FROM cs_contracts WHERE company_id = $1 AND contract_no = $2`;
    if (excludeId !== undefined) {
      params.push(excludeId);
      sql += ` AND id <> $${params.length}`;
    }
    sql += ') AS exists';
    const r = await this.pool.query<{ exists: boolean }>(sql, params);
    return r.rows[0]?.exists ?? false;
  }
}

async function upsertTender(
  client: PoolClient,
  contractId: number,
  t: TenderInfoProps,
): Promise<void> {
  await client.query(
    `INSERT INTO cs_tender_info
       (contract_id, ikn, procedure, approx_cost, tender_date, work_increase_pct, perf_bond_pct, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (contract_id) DO UPDATE
       SET ikn = EXCLUDED.ikn, procedure = EXCLUDED.procedure, approx_cost = EXCLUDED.approx_cost,
           tender_date = EXCLUDED.tender_date, work_increase_pct = EXCLUDED.work_increase_pct,
           perf_bond_pct = EXCLUDED.perf_bond_pct, notes = EXCLUDED.notes`,
    [
      contractId,
      t.ikn,
      t.procedure,
      t.approxCost,
      t.tenderDate,
      t.workIncreasePct,
      t.perfBondPct,
      t.notes,
    ],
  );
}

function rowToContract(row: ContractRow): Contract {
  const tender: TenderInfoProps | null =
    row.t_contract_id === null
      ? null
      : {
          ikn: row.t_ikn,
          procedure: row.t_procedure,
          approxCost: row.t_approx_cost !== null ? Number(row.t_approx_cost) : null,
          tenderDate: row.t_tender_date,
          workIncreasePct: row.t_work_increase_pct !== null ? Number(row.t_work_increase_pct) : 0,
          perfBondPct: row.t_perf_bond_pct !== null ? Number(row.t_perf_bond_pct) : 0,
          notes: row.t_notes,
        };
  return Contract.create({
    id: row.id,
    companyId: row.company_id,
    projectId: row.project_id,
    partyKind: row.party_kind,
    vendorId: row.vendor_id,
    contractNo: row.contract_no,
    title: row.title,
    amount: Number(row.amount),
    currency: row.currency,
    signDate: row.sign_date,
    startDate: row.start_date,
    endDate: row.end_date,
    retentionPct: Number(row.retention_pct),
    advancePct: Number(row.advance_pct),
    priceDiffOn: row.price_diff_on,
    tender,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
