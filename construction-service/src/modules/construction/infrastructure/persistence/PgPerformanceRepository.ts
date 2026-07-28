/**
 * PgPerformanceRepository — FAZ 4 okuma implementasyonu.
 * View'lar: cs_v_boq_performance, cs_v_contract_manhour_summary (008)
 *
 * BIGINT ↔ string: node-pg int8'i STRING döndürür; tüm id ve NUMERIC alanlar
 * Number()'a çevrilir (bkz. 0793b9f). Oran kolonları view'da payda 0 iken NULL
 * gelir ve NULL KORUNUR — 0'a çevirmek "verim yok" ile "verim ölçülemedi"yi
 * karıştırır.
 */
import type { Pool } from 'pg';

import type {
  BoqPerformanceRow,
  ContractManhourSummary,
  PerformanceRepository,
} from '../../application/ports/PerformanceRepository.js';

interface PerfRow {
  boq_line_id: string;
  contract_id: string;
  project_id: string;
  line_no: number;
  poz_no: string | null;
  description: string;
  unit: string;
  location_id: string | null;
  planned_qty: string;
  unit_price: string;
  planned_amount: string;
  pursantaj_pct: string;
  planned_unit_manhours: string;
  planned_manhours: string;
  progress_qty: string;
  progress_amount: string;
  produced_qty: string;
  own_manhours: string;
  sub_manhours: string;
  actual_manhours: string;
  machine_hours: string;
  expense_amount: string;
  progress_pct: string | null;
  produced_pct: string | null;
  manhour_pct: string | null;
  earned_pursantaj: string | null;
  actual_unit_manhours: string | null;
  expected_manhours: string;
  efficiency: string | null;
  manhour_variance: string;
}

const PERF_COLS =
  'boq_line_id, contract_id, project_id, line_no, poz_no, description, unit, location_id, ' +
  'planned_qty, unit_price, planned_amount, pursantaj_pct, planned_unit_manhours, ' +
  'planned_manhours, progress_qty, progress_amount, produced_qty, own_manhours, sub_manhours, ' +
  'actual_manhours, machine_hours, expense_amount, progress_pct, produced_pct, manhour_pct, ' +
  'earned_pursantaj, actual_unit_manhours, expected_manhours, efficiency, manhour_variance';

/** NUMERIC → number; NULL korunur. */
const nn = (v: string | null): number | null => (v === null ? null : Number(v));

function toPerfRow(r: PerfRow): BoqPerformanceRow {
  return {
    boqLineId: Number(r.boq_line_id),
    contractId: Number(r.contract_id),
    projectId: Number(r.project_id),
    lineNo: Number(r.line_no),
    pozNo: r.poz_no,
    description: r.description,
    unit: r.unit,
    locationId: r.location_id === null ? null : Number(r.location_id),
    plannedQty: Number(r.planned_qty),
    unitPrice: Number(r.unit_price),
    plannedAmount: Number(r.planned_amount),
    pursantajPct: Number(r.pursantaj_pct),
    plannedUnitManhours: Number(r.planned_unit_manhours),
    plannedManhours: Number(r.planned_manhours),
    progressQty: Number(r.progress_qty),
    progressAmount: Number(r.progress_amount),
    producedQty: Number(r.produced_qty),
    ownManhours: Number(r.own_manhours),
    subManhours: Number(r.sub_manhours),
    actualManhours: Number(r.actual_manhours),
    machineHours: Number(r.machine_hours),
    expenseAmount: Number(r.expense_amount),
    progressPct: nn(r.progress_pct),
    producedPct: nn(r.produced_pct),
    manhourPct: nn(r.manhour_pct),
    earnedPursantaj: nn(r.earned_pursantaj),
    actualUnitManhours: nn(r.actual_unit_manhours),
    expectedManhours: Number(r.expected_manhours),
    efficiency: nn(r.efficiency),
    manhourVariance: Number(r.manhour_variance),
  };
}

interface SummaryRow {
  contract_id: string;
  project_id: string;
  line_count: string;
  planned_manhours: string;
  actual_manhours: string;
  own_manhours: string;
  sub_manhours: string;
  machine_hours: string;
  expected_manhours: string;
  manhour_variance: string;
  planned_amount: string;
  progress_amount: string;
  expense_amount: string;
  earned_pursantaj: string;
  manhour_pct: string | null;
  efficiency: string | null;
}

const SUM_COLS =
  'contract_id, project_id, line_count, planned_manhours, actual_manhours, own_manhours, ' +
  'sub_manhours, machine_hours, expected_manhours, manhour_variance, planned_amount, ' +
  'progress_amount, expense_amount, earned_pursantaj, manhour_pct, efficiency';

function toSummary(r: SummaryRow): ContractManhourSummary {
  return {
    contractId: Number(r.contract_id),
    projectId: Number(r.project_id),
    lineCount: Number(r.line_count),
    plannedManhours: Number(r.planned_manhours),
    actualManhours: Number(r.actual_manhours),
    ownManhours: Number(r.own_manhours),
    subManhours: Number(r.sub_manhours),
    machineHours: Number(r.machine_hours),
    expectedManhours: Number(r.expected_manhours),
    manhourVariance: Number(r.manhour_variance),
    plannedAmount: Number(r.planned_amount),
    progressAmount: Number(r.progress_amount),
    expenseAmount: Number(r.expense_amount),
    earnedPursantaj: Number(r.earned_pursantaj),
    manhourPct: nn(r.manhour_pct),
    efficiency: nn(r.efficiency),
  };
}

export class PgPerformanceRepository implements PerformanceRepository {
  constructor(private readonly pool: Pool) {}

  async listByContract(
    contractId: number,
    companyId: number,
  ): Promise<ReadonlyArray<BoqPerformanceRow>> {
    const r = await this.pool.query<PerfRow>(
      `SELECT ${PERF_COLS} FROM cs_v_boq_performance
        WHERE contract_id = $1 AND company_id = $2
        ORDER BY line_no`,
      [contractId, companyId],
    );
    return r.rows.map(toPerfRow);
  }

  async listByProject(
    projectId: number,
    companyId: number,
  ): Promise<ReadonlyArray<BoqPerformanceRow>> {
    const r = await this.pool.query<PerfRow>(
      `SELECT ${PERF_COLS} FROM cs_v_boq_performance
        WHERE project_id = $1 AND company_id = $2
        ORDER BY contract_id, line_no`,
      [projectId, companyId],
    );
    return r.rows.map(toPerfRow);
  }

  async contractSummary(
    contractId: number,
    companyId: number,
  ): Promise<ContractManhourSummary | null> {
    const r = await this.pool.query<SummaryRow>(
      `SELECT ${SUM_COLS} FROM cs_v_contract_manhour_summary
        WHERE contract_id = $1 AND company_id = $2`,
      [contractId, companyId],
    );
    const row = r.rows[0];
    return row ? toSummary(row) : null;
  }

  async projectSummaries(
    projectId: number,
    companyId: number,
  ): Promise<ReadonlyArray<ContractManhourSummary>> {
    const r = await this.pool.query<SummaryRow>(
      `SELECT ${SUM_COLS} FROM cs_v_contract_manhour_summary
        WHERE project_id = $1 AND company_id = $2
        ORDER BY contract_id`,
      [projectId, companyId],
    );
    return r.rows.map(toSummary);
  }

  async setUnitManhours(
    companyId: number,
    updates: ReadonlyArray<{ boqLineId: number; unitManhours: number }>,
  ): Promise<number> {
    if (updates.length === 0) return 0;
    // Tek UPDATE ... FROM unnest: satır başına tur atmamak için.
    const r = await this.pool.query(
      `UPDATE cs_boq_lines l
          SET unit_manhours = u.mh, updated_at = NOW()
         FROM unnest($1::bigint[], $2::numeric[]) AS u(id, mh)
        WHERE l.id = u.id AND l.company_id = $3`,
      [updates.map((u) => u.boqLineId), updates.map((u) => u.unitManhours), companyId],
    );
    return r.rowCount ?? 0;
  }
}
