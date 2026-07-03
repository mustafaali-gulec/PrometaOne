/**
 * PgMeasurementBookRepository / PgAttachmentRepository.
 * Tablolar: cs_measurement_book, cs_attachments (001_construction_schema.sql).
 * BIGINT id/FK alanları satır eşleyicide Number()'a çevrilir; NUMERIC alanlar da.
 * Tüm sorgular company_id ile scope'lanır.
 */
import type {
  AttachmentRepository,
  MeasurementBookRepository,
  NewAttachmentInput,
  NewMeasurementInput,
} from '../../application/ports/MeasurementRepositories.js';
import type { MeasurementSummaryLineDto } from '../../application/dto/MeasurementDtos.js';
import { Attachment } from '../../domain/entities/Attachment.js';
import { MeasurementBook } from '../../domain/entities/MeasurementBook.js';

import type { Queryable } from './Queryable.js';

// ===== MEASUREMENT BOOK (Yeşil Defter) =====================================
interface MeasurementRow {
  id: string;
  company_id: number;
  contract_id: string;
  boq_line_id: string;
  progress_id: string | null;
  measured_qty: string;
  measured_at: string | null;
  note: string | null;
  created_by: number | null;
  created_at: Date;
}

const M_COLS =
  'id, company_id, contract_id, boq_line_id, progress_id, measured_qty, ' +
  'measured_at::text AS measured_at, note, created_by, created_at';

function rowToMeasurement(r: MeasurementRow): MeasurementBook {
  return MeasurementBook.create({
    id: Number(r.id),
    companyId: r.company_id,
    contractId: Number(r.contract_id),
    boqLineId: Number(r.boq_line_id),
    progressId: r.progress_id != null ? Number(r.progress_id) : null,
    measuredQty: Number(r.measured_qty),
    measuredAt: r.measured_at,
    note: r.note,
    createdBy: r.created_by,
    createdAt: r.created_at,
  });
}

export class PgMeasurementBookRepository implements MeasurementBookRepository {
  constructor(private readonly db: Queryable) {}

  async insert(input: NewMeasurementInput): Promise<MeasurementBook> {
    const r = await this.db.query<MeasurementRow>(
      `INSERT INTO cs_measurement_book
         (company_id, contract_id, boq_line_id, progress_id, measured_qty, measured_at, note, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING ${M_COLS}`,
      [
        input.companyId,
        input.contractId,
        input.boqLineId,
        input.progressId,
        input.measuredQty,
        input.measuredAt,
        input.note,
        input.createdBy,
      ],
    );
    return rowToMeasurement(r.rows[0]!);
  }

  async update(m: MeasurementBook): Promise<void> {
    await this.db.query(
      `UPDATE cs_measurement_book
         SET progress_id = $1, measured_qty = $2, measured_at = $3, note = $4
       WHERE id = $5 AND company_id = $6`,
      [m.progressId, m.measuredQty, m.measuredAt, m.note, m.id, m.companyId],
    );
  }

  async delete(id: number, companyId: number): Promise<boolean> {
    const r = await this.db.query(
      `DELETE FROM cs_measurement_book WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async findById(id: number, companyId: number): Promise<MeasurementBook | null> {
    const r = await this.db.query<MeasurementRow>(
      `SELECT ${M_COLS} FROM cs_measurement_book WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToMeasurement(row) : null;
  }

  async listByContract(
    contractId: number,
    companyId: number,
  ): Promise<ReadonlyArray<MeasurementBook>> {
    const r = await this.db.query<MeasurementRow>(
      `SELECT ${M_COLS} FROM cs_measurement_book
       WHERE contract_id = $1 AND company_id = $2
       ORDER BY measured_at DESC NULLS LAST, id DESC`,
      [contractId, companyId],
    );
    return r.rows.map(rowToMeasurement);
  }

  async summaryByContract(
    contractId: number,
    companyId: number,
  ): Promise<ReadonlyArray<MeasurementSummaryLineDto>> {
    const r = await this.db.query<{ boq_line_id: string; total: string }>(
      `SELECT boq_line_id, COALESCE(SUM(measured_qty), 0) AS total
       FROM cs_measurement_book
       WHERE contract_id = $1 AND company_id = $2
       GROUP BY boq_line_id
       ORDER BY boq_line_id`,
      [contractId, companyId],
    );
    return r.rows.map((row) => ({
      boqLineId: Number(row.boq_line_id),
      totalMeasured: Number(row.total),
    }));
  }
}

// ===== ATTACHMENT (Ataşman) ================================================
interface AttachmentRow {
  id: string;
  company_id: number;
  measurement_id: string;
  boq_line_id: string | null;
  formula: string | null;
  dim_a: string | null;
  dim_b: string | null;
  dim_c: string | null;
  count_n: string | null;
  result_qty: string;
  file_url: string | null;
  created_at: Date;
}

const A_COLS =
  'id, company_id, measurement_id, boq_line_id, formula, dim_a, dim_b, dim_c, ' +
  'count_n, result_qty, file_url, created_at';

const num = (v: string | null): number | null => (v != null ? Number(v) : null);

function rowToAttachment(r: AttachmentRow): Attachment {
  return Attachment.create({
    id: Number(r.id),
    companyId: r.company_id,
    measurementId: Number(r.measurement_id),
    boqLineId: r.boq_line_id != null ? Number(r.boq_line_id) : null,
    formula: r.formula,
    dimA: num(r.dim_a),
    dimB: num(r.dim_b),
    dimC: num(r.dim_c),
    countN: num(r.count_n),
    resultQty: Number(r.result_qty),
    fileUrl: r.file_url,
    createdAt: r.created_at,
  });
}

export class PgAttachmentRepository implements AttachmentRepository {
  constructor(private readonly db: Queryable) {}

  async insert(input: NewAttachmentInput): Promise<Attachment> {
    const r = await this.db.query<AttachmentRow>(
      `INSERT INTO cs_attachments
         (company_id, measurement_id, boq_line_id, formula, dim_a, dim_b, dim_c, count_n, result_qty, file_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING ${A_COLS}`,
      [
        input.companyId,
        input.measurementId,
        input.boqLineId,
        input.formula,
        input.dimA,
        input.dimB,
        input.dimC,
        input.countN,
        input.resultQty,
        input.fileUrl,
      ],
    );
    return rowToAttachment(r.rows[0]!);
  }

  async update(a: Attachment): Promise<void> {
    await this.db.query(
      `UPDATE cs_attachments
         SET boq_line_id = $1, formula = $2, dim_a = $3, dim_b = $4, dim_c = $5,
             count_n = $6, result_qty = $7, file_url = $8
       WHERE id = $9 AND company_id = $10`,
      [
        a.boqLineId,
        a.formula,
        a.dimA,
        a.dimB,
        a.dimC,
        a.countN,
        a.resultQty,
        a.fileUrl,
        a.id,
        a.companyId,
      ],
    );
  }

  async delete(id: number, companyId: number): Promise<boolean> {
    const r = await this.db.query(`DELETE FROM cs_attachments WHERE id = $1 AND company_id = $2`, [
      id,
      companyId,
    ]);
    return (r.rowCount ?? 0) > 0;
  }

  async findById(id: number, companyId: number): Promise<Attachment | null> {
    const r = await this.db.query<AttachmentRow>(
      `SELECT ${A_COLS} FROM cs_attachments WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToAttachment(row) : null;
  }

  async listByMeasurement(
    measurementId: number,
    companyId: number,
  ): Promise<ReadonlyArray<Attachment>> {
    const r = await this.db.query<AttachmentRow>(
      `SELECT ${A_COLS} FROM cs_attachments
       WHERE measurement_id = $1 AND company_id = $2
       ORDER BY id ASC`,
      [measurementId, companyId],
    );
    return r.rows.map(rowToAttachment);
  }

  async sumByMeasurement(measurementId: number, companyId: number): Promise<number> {
    const r = await this.db.query<{ total: string }>(
      `SELECT COALESCE(SUM(result_qty), 0) AS total FROM cs_attachments
       WHERE measurement_id = $1 AND company_id = $2`,
      [measurementId, companyId],
    );
    return Number(r.rows[0]?.total ?? 0);
  }
}
