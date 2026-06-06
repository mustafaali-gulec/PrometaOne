/**
 * PgBoqRepository — BoqRepository PG implementasyonu.
 * Tablo: cs_boq_lines (024_cs_boq.sql).
 *
 * replaceLines bir sözleşmenin tüm satırlarını transaction içinde değiştirir
 * (DELETE + toplu INSERT). company_id ile tenant izolasyonu.
 */
import type { Pool } from 'pg';

import type { BoqRepository, NewBoqLineInput } from '../../application/ports/BoqRepository.js';
import { BoqLine } from '../../domain/entities/BoqLine.js';

interface BoqLineRow {
  id: number;
  company_id: number;
  contract_id: number;
  group_id: number | null;
  poz_id: number | null;
  line_no: number;
  poz_no: string | null;
  description: string;
  unit: string;
  quantity: string;
  unit_price: string;
  amount: string;
  pursantaj_pct: string;
  created_at: Date;
  updated_at: Date;
}

const COLS =
  'id, company_id, contract_id, group_id, poz_id, line_no, poz_no, description, unit, ' +
  'quantity, unit_price, amount, pursantaj_pct, created_at, updated_at';

export class PgBoqRepository implements BoqRepository {
  constructor(private readonly pool: Pool) {}

  async listLinesByContract(
    contractId: number,
    companyId: number,
  ): Promise<ReadonlyArray<BoqLine>> {
    const r = await this.pool.query<BoqLineRow>(
      `SELECT ${COLS} FROM cs_boq_lines
        WHERE contract_id = $1 AND company_id = $2
        ORDER BY line_no ASC, id ASC`,
      [contractId, companyId],
    );
    return r.rows.map(rowToBoqLine);
  }

  async replaceLines(
    contractId: number,
    companyId: number,
    lines: ReadonlyArray<NewBoqLineInput>,
  ): Promise<ReadonlyArray<BoqLine>> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM cs_boq_lines WHERE contract_id = $1 AND company_id = $2`, [
        contractId,
        companyId,
      ]);
      const out: BoqLine[] = [];
      for (const l of lines) {
        const r = await client.query<BoqLineRow>(
          `INSERT INTO cs_boq_lines
             (company_id, contract_id, group_id, poz_id, line_no, poz_no, description, unit,
              quantity, unit_price, amount, pursantaj_pct)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           RETURNING ${COLS}`,
          [
            companyId,
            contractId,
            l.groupId,
            l.pozId,
            l.lineNo,
            l.pozNo,
            l.description,
            l.unit,
            l.quantity,
            l.unitPrice,
            l.amount,
            l.pursantajPct,
          ],
        );
        out.push(rowToBoqLine(r.rows[0]!));
      }
      await client.query('COMMIT');
      return out;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

function rowToBoqLine(row: BoqLineRow): BoqLine {
  return BoqLine.create({
    id: Number(row.id),
    companyId: row.company_id,
    contractId: Number(row.contract_id),
    groupId: row.group_id !== null ? Number(row.group_id) : null,
    pozId: row.poz_id !== null ? Number(row.poz_id) : null,
    lineNo: row.line_no,
    pozNo: row.poz_no,
    description: row.description,
    unit: row.unit,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    amount: Number(row.amount),
    pursantajPct: Number(row.pursantaj_pct),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
