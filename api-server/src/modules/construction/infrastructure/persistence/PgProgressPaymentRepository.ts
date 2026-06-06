/**
 * PgProgressPaymentRepository — ProgressPaymentRepository PG implementasyonu.
 * Tablolar: cs_progress_payments (+ cs_progress_lines, cs_progress_deductions,
 * cs_progress_status_history). Çok tablolu yazımlar transaction.
 */
import type { Pool, PoolClient } from 'pg';

import type {
  BoqLineCumulative,
  HeaderTotals,
  NewDeductionInput,
  NewProgressInput,
  NewProgressLineInput,
  ProgressPaymentRepository,
  StatusChange,
} from '../../application/ports/ProgressPaymentRepository.js';
import {
  ProgressPayment,
  type DeductionData,
  type ProgressLineData,
  type ProgressPaymentProps,
} from '../../domain/entities/ProgressPayment.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';
import type { DeductionKind } from '../../domain/valueObjects/Deduction.js';
import type {
  ProgressKind,
  ProgressStatus,
  ProgressType,
} from '../../domain/valueObjects/ProgressStatus.js';

interface HeaderRow {
  id: number;
  company_id: number;
  contract_id: number;
  hakedis_no: string;
  kind: ProgressKind;
  ptype: ProgressType;
  seq_no: number;
  period_start: string | null;
  period_end: string | null;
  status: ProgressStatus;
  gross_this: string;
  gross_cumul: string;
  price_diff: string;
  deductions_tot: string;
  net_payable: string;
  currency: CurrencyCode;
  submitted_at: Date | null;
  approved_at: Date | null;
  approved_by: number | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

interface LineRow {
  id: number;
  boq_line_id: number;
  prev_qty: string;
  this_qty: string;
  cumul_qty: string;
  unit_price: string;
  this_amount: string;
  cumul_amount: string;
}

interface DeductionRow {
  id: number;
  kind: DeductionKind;
  label: string | null;
  rate_pct: string | null;
  amount: string;
  sign: number;
}

const HCOLS =
  'id, company_id, contract_id, hakedis_no, kind, ptype, seq_no, period_start::text AS period_start, ' +
  'period_end::text AS period_end, status, gross_this, gross_cumul, price_diff, deductions_tot, ' +
  'net_payable, currency, submitted_at, approved_at, approved_by, created_by, created_at, updated_at';

export class PgProgressPaymentRepository implements ProgressPaymentRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewProgressInput): Promise<ProgressPayment> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query<{ id: number }>(
        `INSERT INTO cs_progress_payments
           (company_id, contract_id, hakedis_no, kind, ptype, seq_no, period_start, period_end,
            status, gross_this, gross_cumul, price_diff, deductions_tot, net_payable, currency, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,$10,$11,$12,$13,$14,$15)
         RETURNING id`,
        [
          input.companyId,
          input.contractId,
          input.hakedisNo,
          input.kind,
          input.ptype,
          input.seqNo,
          input.periodStart,
          input.periodEnd,
          input.totals.grossThis,
          input.totals.grossCumul,
          input.totals.priceDiff,
          input.totals.deductionsTot,
          input.totals.netPayable,
          input.currency,
          input.createdBy,
        ],
      );
      const id = r.rows[0]!.id;
      await insertLines(client, id, input.lines);
      await client.query('COMMIT');
      const created = await this.findById(id, input.companyId);
      if (!created) throw new Error('Hakediş insert sonrası okunamadı');
      return created;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findById(id: number, companyId: number): Promise<ProgressPayment | null> {
    const h = await this.pool.query<HeaderRow>(
      `SELECT ${HCOLS} FROM cs_progress_payments WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const header = h.rows[0];
    if (!header) return null;
    const lines = await this.pool.query<LineRow>(
      `SELECT id, boq_line_id, prev_qty, this_qty, cumul_qty, unit_price, this_amount, cumul_amount
         FROM cs_progress_lines WHERE progress_id = $1 ORDER BY id ASC`,
      [id],
    );
    const deds = await this.pool.query<DeductionRow>(
      `SELECT id, kind, label, rate_pct, amount, sign
         FROM cs_progress_deductions WHERE progress_id = $1 ORDER BY id ASC`,
      [id],
    );
    return buildEntity(header, lines.rows, deds.rows);
  }

  async listByContract(
    contractId: number,
    companyId: number,
    kind?: ProgressKind,
  ): Promise<ReadonlyArray<ProgressPayment>> {
    const params: unknown[] = [contractId, companyId];
    let sql = `SELECT ${HCOLS} FROM cs_progress_payments WHERE contract_id = $1 AND company_id = $2`;
    if (kind !== undefined) {
      params.push(kind);
      sql += ` AND kind = $${params.length}`;
    }
    sql += ' ORDER BY kind ASC, seq_no DESC';
    const r = await this.pool.query<HeaderRow>(sql, params);
    return r.rows.map((row) => buildEntity(row, [], []));
  }

  async countByContractKind(
    contractId: number,
    companyId: number,
    kind: ProgressKind,
  ): Promise<number> {
    const r = await this.pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM cs_progress_payments
        WHERE contract_id = $1 AND company_id = $2 AND kind = $3`,
      [contractId, companyId, kind],
    );
    return Number(r.rows[0]?.n ?? '0');
  }

  async sumApprovedQtyByBoqLine(
    contractId: number,
    companyId: number,
    kind: ProgressKind,
  ): Promise<ReadonlyArray<BoqLineCumulative>> {
    const r = await this.pool.query<{ boq_line_id: number; qty: string }>(
      `SELECT pl.boq_line_id, SUM(pl.this_qty)::text AS qty
         FROM cs_progress_lines pl
         JOIN cs_progress_payments pp ON pp.id = pl.progress_id
        WHERE pp.contract_id = $1 AND pp.company_id = $2 AND pp.kind = $3
          AND pp.status IN ('approved', 'paid')
        GROUP BY pl.boq_line_id`,
      [contractId, companyId, kind],
    );
    return r.rows.map((row) => ({ boqLineId: Number(row.boq_line_id), qty: Number(row.qty) }));
  }

  async saveLines(
    progressId: number,
    companyId: number,
    lines: ReadonlyArray<NewProgressLineInput>,
    totals: HeaderTotals,
  ): Promise<ProgressPayment> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await assertOwned(client, progressId, companyId);
      await client.query(`DELETE FROM cs_progress_lines WHERE progress_id = $1`, [progressId]);
      await insertLines(client, progressId, lines);
      await client.query(
        `UPDATE cs_progress_payments
           SET gross_this = $1, gross_cumul = $2, net_payable = $3, updated_at = NOW()
         WHERE id = $4 AND company_id = $5`,
        [totals.grossThis, totals.grossCumul, totals.netPayable, progressId, companyId],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return this.requireById(progressId, companyId);
  }

  async saveDeductions(
    progressId: number,
    companyId: number,
    deductions: ReadonlyArray<NewDeductionInput>,
    totals: HeaderTotals,
  ): Promise<ProgressPayment> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await assertOwned(client, progressId, companyId);
      await client.query(`DELETE FROM cs_progress_deductions WHERE progress_id = $1`, [progressId]);
      for (const d of deductions) {
        await client.query(
          `INSERT INTO cs_progress_deductions (progress_id, kind, label, rate_pct, amount, sign)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [progressId, d.kind, d.label, d.ratePct, d.amount, d.sign],
        );
      }
      await client.query(
        `UPDATE cs_progress_payments
           SET price_diff = $1, deductions_tot = $2, net_payable = $3, updated_at = NOW()
         WHERE id = $4 AND company_id = $5`,
        [totals.priceDiff, totals.deductionsTot, totals.netPayable, progressId, companyId],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return this.requireById(progressId, companyId);
  }

  async changeStatus(
    progressId: number,
    companyId: number,
    change: StatusChange,
  ): Promise<ProgressPayment> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await assertOwned(client, progressId, companyId);
      await client.query(
        `UPDATE cs_progress_payments
           SET status = $1, submitted_at = $2, approved_at = $3, approved_by = $4, updated_at = NOW()
         WHERE id = $5 AND company_id = $6`,
        [
          change.toStatus,
          change.submittedAt,
          change.approvedAt,
          change.approvedBy,
          progressId,
          companyId,
        ],
      );
      await client.query(
        `INSERT INTO cs_progress_status_history (progress_id, from_status, to_status, actor_user_id, note)
         VALUES ($1,$2,$3,$4,$5)`,
        [progressId, change.fromStatus, change.toStatus, change.actorUserId, change.note],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return this.requireById(progressId, companyId);
  }

  private async requireById(id: number, companyId: number): Promise<ProgressPayment> {
    const p = await this.findById(id, companyId);
    if (!p) throw new Error('Hakediş güncelleme sonrası okunamadı');
    return p;
  }
}

async function assertOwned(client: PoolClient, id: number, companyId: number): Promise<void> {
  const r = await client.query<{ id: number }>(
    `SELECT id FROM cs_progress_payments WHERE id = $1 AND company_id = $2 FOR UPDATE`,
    [id, companyId],
  );
  if (r.rows.length === 0) throw new Error('Hakediş bulunamadı (tenant)');
}

async function insertLines(
  client: PoolClient,
  progressId: number,
  lines: ReadonlyArray<NewProgressLineInput>,
): Promise<void> {
  for (const l of lines) {
    await client.query(
      `INSERT INTO cs_progress_lines
         (progress_id, boq_line_id, prev_qty, this_qty, cumul_qty, unit_price, this_amount, cumul_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        progressId,
        l.boqLineId,
        l.prevQty,
        l.thisQty,
        l.cumulQty,
        l.unitPrice,
        l.thisAmount,
        l.cumulAmount,
      ],
    );
  }
}

function buildEntity(
  header: HeaderRow,
  lineRows: ReadonlyArray<LineRow>,
  dedRows: ReadonlyArray<DeductionRow>,
): ProgressPayment {
  const lines: ProgressLineData[] = lineRows.map((r) => ({
    id: Number(r.id),
    boqLineId: Number(r.boq_line_id),
    prevQty: Number(r.prev_qty),
    thisQty: Number(r.this_qty),
    cumulQty: Number(r.cumul_qty),
    unitPrice: Number(r.unit_price),
    thisAmount: Number(r.this_amount),
    cumulAmount: Number(r.cumul_amount),
  }));
  const deductions: DeductionData[] = dedRows.map((r) => ({
    id: Number(r.id),
    kind: r.kind,
    label: r.label,
    ratePct: r.rate_pct !== null ? Number(r.rate_pct) : null,
    amount: Number(r.amount),
    sign: r.sign,
  }));
  const props: ProgressPaymentProps = {
    id: Number(header.id),
    companyId: header.company_id,
    contractId: Number(header.contract_id),
    hakedisNo: header.hakedis_no,
    kind: header.kind,
    ptype: header.ptype,
    seqNo: header.seq_no,
    periodStart: header.period_start,
    periodEnd: header.period_end,
    status: header.status,
    grossThis: Number(header.gross_this),
    grossCumul: Number(header.gross_cumul),
    priceDiff: Number(header.price_diff),
    deductionsTot: Number(header.deductions_tot),
    netPayable: Number(header.net_payable),
    currency: header.currency,
    submittedAt: header.submitted_at,
    approvedAt: header.approved_at,
    approvedBy: header.approved_by,
    createdBy: header.created_by,
    createdAt: header.created_at,
    updatedAt: header.updated_at,
    lines,
    deductions,
  };
  return ProgressPayment.create(props);
}
