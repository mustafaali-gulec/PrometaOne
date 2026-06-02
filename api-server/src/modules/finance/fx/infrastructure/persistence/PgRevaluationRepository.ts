/**
 * PgRevaluationRepository — revaluations (006). details JSONB.
 */
import { Money } from '../../../domain/valueObjects/Money.js';
import type { Queryable } from '../../../infrastructure/persistence/Queryable.js';
import type { RevaluationRepository } from '../../application/ports/FxPorts.js';
import { Revaluation } from '../../domain/entities/Revaluation.js';
import type { RevaluationLineResult } from '../../domain/services/RevaluationCalculator.js';

interface RevaluationRow {
  id: number;
  company_id: number;
  reference_date: string;
  valuation_date: string;
  usd_rate_1: string | null;
  usd_rate_2: string | null;
  eur_rate_1: string | null;
  eur_rate_2: string | null;
  gain_total: string;
  loss_total: string;
  net: string;
  details: RevaluationLineResult[];
  posted: boolean;
  posted_at: Date | null;
  created_by: number | null;
  created_at: Date;
}

const SELECT = `
  SELECT id, company_id,
         to_char(reference_date, 'YYYY-MM-DD') AS reference_date,
         to_char(valuation_date, 'YYYY-MM-DD') AS valuation_date,
         usd_rate_1, usd_rate_2, eur_rate_1, eur_rate_2,
         gain_total, loss_total, net, details, posted, posted_at, created_by, created_at
    FROM revaluations`;

export class PgRevaluationRepository implements RevaluationRepository {
  constructor(private readonly db: Queryable) {}

  async insert(revaluation: Revaluation): Promise<Revaluation> {
    const j = revaluation.toJSON();
    const r = await this.db.query<{ id: number }>(
      `INSERT INTO revaluations
         (company_id, reference_date, valuation_date, usd_rate_1, usd_rate_2,
          eur_rate_1, eur_rate_2, gain_total, loss_total, net, details, posted,
          posted_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id`,
      [
        j.companyId,
        j.referenceDate,
        j.valuationDate,
        j.usdRate1,
        j.usdRate2,
        j.eurRate1,
        j.eurRate2,
        j.gainTotal,
        j.lossTotal,
        j.net,
        JSON.stringify(j.details),
        j.posted,
        j.postedAt,
        revaluation.createdBy,
      ],
    );
    return revaluation.withId(r.rows[0]!.id);
  }

  async update(revaluation: Revaluation): Promise<void> {
    const j = revaluation.toJSON();
    await this.db.query(
      `UPDATE revaluations SET posted = $1, posted_at = $2 WHERE id = $3 AND company_id = $4`,
      [j.posted, j.postedAt, revaluation.id, revaluation.companyId],
    );
  }

  async findById(id: number, companyId: number): Promise<Revaluation | null> {
    const r = await this.db.query<RevaluationRow>(
      `${SELECT} WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToRevaluation(row) : null;
  }

  async listByCompany(companyId: number): Promise<ReadonlyArray<Revaluation>> {
    const r = await this.db.query<RevaluationRow>(
      `${SELECT} WHERE company_id = $1 ORDER BY valuation_date DESC, id DESC`,
      [companyId],
    );
    return r.rows.map(rowToRevaluation);
  }
}

function rowToRevaluation(row: RevaluationRow): Revaluation {
  return Revaluation.create({
    id: row.id,
    companyId: row.company_id,
    referenceDate: row.reference_date,
    valuationDate: row.valuation_date,
    usdRate1: Number(row.usd_rate_1 ?? 0),
    usdRate2: Number(row.usd_rate_2 ?? 0),
    eurRate1: Number(row.eur_rate_1 ?? 0),
    eurRate2: Number(row.eur_rate_2 ?? 0),
    gainTotal: Money.fromDecimalString(row.gain_total, 'TRY'),
    lossTotal: Money.fromDecimalString(row.loss_total, 'TRY'),
    net: Money.fromDecimalString(row.net, 'TRY'),
    details: Array.isArray(row.details) ? row.details : [],
    posted: row.posted,
    postedAt: row.posted_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  });
}
