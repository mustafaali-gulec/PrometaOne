/**
 * PgCommitmentRepository — CommitmentRepository PG implementasyonu (FAZ 7).
 * Tablo: cs_commitments; görünümler: cs_v_project_commitments, cs_v_contract_evm.
 *
 * BIGINT kolonları node-pg'de STRING döner — mapper Number() çevirir.
 */
import type { Pool } from 'pg';

import type {
  CommitmentFilter,
  CommitmentRepository,
  ContractEvmRow,
  NewCommitmentInput,
  ProjectCommitmentSummaryRow,
} from '../../application/ports/CommitmentRepository.js';
import {
  Commitment,
  type CommitmentProps,
  type CommitmentSource,
  type CommitmentStatus,
} from '../../domain/entities/Commitment.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';

const n = (v: string | number | null): number | null =>
  v === null ? null : typeof v === 'number' ? v : Number(v);
const nn = (v: string | number): number => (typeof v === 'number' ? v : Number(v));

interface CommitmentRow {
  id: string;
  company_id: number;
  project_id: string;
  contract_id: string | null;
  boq_line_id: string | null;
  location_id: string | null;
  source: CommitmentSource;
  ref_no: string;
  ref_line_no: number;
  vendor_id: string | null;
  description: string;
  quantity: string;
  unit: string | null;
  unit_price: string;
  amount: string;
  delivered_amount: string;
  currency: CurrencyCode;
  status: CommitmentStatus;
  committed_at: string;
  closed_at: Date | null;
  note: string | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

const COLS =
  'id, company_id, project_id, contract_id, boq_line_id, location_id, source, ref_no, ' +
  'ref_line_no, vendor_id, description, quantity, unit, unit_price, amount, delivered_amount, ' +
  'currency, status, committed_at::text AS committed_at, closed_at, note, created_by, ' +
  'created_at, updated_at';

function toCommitment(r: CommitmentRow): Commitment {
  const props: CommitmentProps = {
    id: nn(r.id),
    companyId: r.company_id,
    projectId: nn(r.project_id),
    contractId: n(r.contract_id),
    boqLineId: n(r.boq_line_id),
    locationId: n(r.location_id),
    source: r.source,
    refNo: r.ref_no,
    refLineNo: r.ref_line_no,
    vendorId: n(r.vendor_id),
    description: r.description,
    quantity: Number(r.quantity),
    unit: r.unit,
    unitPrice: Number(r.unit_price),
    amount: Number(r.amount),
    deliveredAmount: Number(r.delivered_amount),
    currency: r.currency,
    status: r.status,
    committedAt: r.committed_at,
    closedAt: r.closed_at,
    note: r.note,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
  return Commitment.create(props);
}

export class PgCommitmentRepository implements CommitmentRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewCommitmentInput): Promise<Commitment> {
    const res = await this.pool.query<CommitmentRow>(
      `INSERT INTO cs_commitments
         (company_id, project_id, contract_id, boq_line_id, location_id, source, ref_no,
          ref_line_no, vendor_id, description, quantity, unit, unit_price, amount,
          delivered_amount, currency, committed_at, note, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING ${COLS}`,
      [
        input.companyId,
        input.projectId,
        input.contractId,
        input.boqLineId,
        input.locationId,
        input.source,
        input.refNo,
        input.refLineNo,
        input.vendorId,
        input.description,
        input.quantity,
        input.unit,
        input.unitPrice,
        input.amount,
        input.deliveredAmount,
        input.currency,
        input.committedAt,
        input.note,
        input.createdBy,
      ],
    );
    return toCommitment(res.rows[0]!);
  }

  async findById(id: number, companyId: number): Promise<Commitment | null> {
    const res = await this.pool.query<CommitmentRow>(
      `SELECT ${COLS} FROM cs_commitments WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    return res.rows[0] === undefined ? null : toCommitment(res.rows[0]);
  }

  async findByRef(
    companyId: number,
    source: CommitmentSource,
    refNo: string,
    refLineNo: number,
  ): Promise<Commitment | null> {
    const res = await this.pool.query<CommitmentRow>(
      `SELECT ${COLS} FROM cs_commitments
        WHERE company_id = $1 AND source = $2 AND ref_no = $3 AND ref_line_no = $4`,
      [companyId, source, refNo, refLineNo],
    );
    return res.rows[0] === undefined ? null : toCommitment(res.rows[0]);
  }

  async list(companyId: number, filter: CommitmentFilter = {}): Promise<ReadonlyArray<Commitment>> {
    const where = ['company_id = $1'];
    const params: unknown[] = [companyId];
    const p = (v: unknown): string => {
      params.push(v);
      return `$${String(params.length)}`;
    };
    if (filter.projectId !== undefined) where.push(`project_id = ${p(filter.projectId)}`);
    if (filter.contractId !== undefined) where.push(`contract_id = ${p(filter.contractId)}`);
    if (filter.boqLineId !== undefined) where.push(`boq_line_id = ${p(filter.boqLineId)}`);
    if (filter.vendorId !== undefined) where.push(`vendor_id = ${p(filter.vendorId)}`);
    if (filter.source !== undefined) where.push(`source = ${p(filter.source)}`);
    if (filter.status !== undefined) where.push(`status = ${p(filter.status)}`);
    if (filter.openOnly === true) where.push(`status IN ('open','partial')`);
    if (filter.search !== undefined && filter.search.trim() !== '') {
      const term = p(`%${filter.search.trim()}%`);
      where.push(`(description ILIKE ${term} OR ref_no ILIKE ${term})`);
    }
    const res = await this.pool.query<CommitmentRow>(
      `SELECT ${COLS} FROM cs_commitments
        WHERE ${where.join(' AND ')}
        ORDER BY status IN ('open','partial') DESC, committed_at DESC, id DESC`,
      params,
    );
    return res.rows.map(toCommitment);
  }

  async update(commitment: Commitment): Promise<Commitment> {
    const j = commitment.toJSON();
    const res = await this.pool.query<CommitmentRow>(
      `UPDATE cs_commitments SET
         contract_id = $1, boq_line_id = $2, location_id = $3, vendor_id = $4,
         description = $5, quantity = $6, unit = $7, unit_price = $8, amount = $9,
         delivered_amount = $10, status = $11, committed_at = $12, closed_at = $13,
         note = $14, updated_at = NOW()
       WHERE id = $15 AND company_id = $16
       RETURNING ${COLS}`,
      [
        j.contractId,
        j.boqLineId,
        j.locationId,
        j.vendorId,
        j.description,
        j.quantity,
        j.unit,
        j.unitPrice,
        j.amount,
        j.deliveredAmount,
        j.status,
        j.committedAt,
        j.closedAt,
        j.note,
        j.id,
        j.companyId,
      ],
    );
    return toCommitment(res.rows[0]!);
  }

  async projectSummary(
    companyId: number,
    projectId: number,
  ): Promise<ProjectCommitmentSummaryRow | null> {
    const res = await this.pool.query<{
      project_id: string;
      commitment_count: string;
      open_count: string;
      committed_total: string | null;
      open_committed: string;
      unlinked_count: string;
      unlinked_amount: string;
    }>(`SELECT * FROM cs_v_project_commitments WHERE company_id = $1 AND project_id = $2`, [
      companyId,
      projectId,
    ]);
    const r = res.rows[0];
    if (r === undefined) return null;
    return {
      projectId: nn(r.project_id),
      commitmentCount: Number(r.commitment_count),
      openCount: Number(r.open_count),
      committedTotal: Number(r.committed_total ?? 0),
      openCommitted: Number(r.open_committed),
      unlinkedCount: Number(r.unlinked_count),
      unlinkedAmount: Number(r.unlinked_amount),
    };
  }

  async contractEvm(companyId: number, contractId: number): Promise<ContractEvmRow | null> {
    const rows = await this.evmRows(companyId, 'contract_id = $2', [contractId]);
    return rows[0] ?? null;
  }

  async projectEvm(companyId: number, projectId: number): Promise<ReadonlyArray<ContractEvmRow>> {
    return this.evmRows(companyId, 'project_id = $2', [projectId]);
  }

  private async evmRows(
    companyId: number,
    cond: string,
    params: unknown[],
  ): Promise<ContractEvmRow[]> {
    const res = await this.pool.query<{
      contract_id: string;
      project_id: string;
      line_count: string;
      bac: string;
      ev: string;
      ac: string;
      committed_amount: string;
      open_committed: string;
      cost_exposure: string;
      budget_remaining: string;
      cpi: string | null;
      pct_earned: string | null;
      pct_spent: string | null;
      pct_exposure: string | null;
    }>(`SELECT * FROM cs_v_contract_evm WHERE company_id = $1 AND ${cond} ORDER BY contract_id`, [
      companyId,
      ...params,
    ]);
    return res.rows.map((r) => ({
      contractId: nn(r.contract_id),
      projectId: nn(r.project_id),
      lineCount: Number(r.line_count),
      bac: Number(r.bac),
      ev: Number(r.ev),
      ac: Number(r.ac),
      committedAmount: Number(r.committed_amount),
      openCommitted: Number(r.open_committed),
      costExposure: Number(r.cost_exposure),
      budgetRemaining: Number(r.budget_remaining),
      cpi: r.cpi === null ? null : Number(r.cpi),
      pctEarned: r.pct_earned === null ? null : Number(r.pct_earned),
      pctSpent: r.pct_spent === null ? null : Number(r.pct_spent),
      pctExposure: r.pct_exposure === null ? null : Number(r.pct_exposure),
    }));
  }
}
