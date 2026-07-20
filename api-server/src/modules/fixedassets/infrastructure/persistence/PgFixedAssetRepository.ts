/**
 * PgFixedAssetRepository — FixedAssetRepository PORT'unun PG implementasyonu.
 * Tablolar: fixed_assets + fixed_asset_movements + fixed_asset_depreciation_runs
 * (043_fixed_assets.sql).
 *
 * Upsert ON CONFLICT (company_id, client_id) iledir — conflict hedefi
 * company_id içerdiğinden cross-tenant client_id çakışması yapısal olarak
 * imkânsızdır. syncAll üç koleksiyonu TEK transaction'da yazar
 * (pool.connect() + BEGIN/COMMIT — PgBomRepository kalıbı). NUMERIC kolonlar
 * string döner → Number(); DATE → 'YYYY-MM-DD'; TIMESTAMPTZ → ISO string.
 */
import type { Pool } from 'pg';

import type {
  DepreciationRunDto,
  DepreciationRunLineDto,
  FixedAssetDto,
  FixedAssetMethod,
  FixedAssetMovementDto,
  FixedAssetMovementType,
  FixedAssetStatus,
  SyncFixedAssetsPayloadDto,
  SyncFixedAssetsResultDto,
} from '../../application/dto/FixedAssetDtos.js';
import type { FixedAssetRepository } from '../../application/ports/FixedAssetRepository.js';

import type { Queryable } from './Queryable.js';

function iso(value: Date | string | null): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function isoDateOnly(value: Date | string | null): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    // pg DATE → yerel gece yarısı Date; toISOString() UTC'ye çevirip günü kaydırır.
    // Yerel bileşenlerle formatla (kıst ay hesabı tarihe duyarlı).
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

function num(value: string | number | null): number {
  return value == null ? 0 : Number(value);
}

function numOrNull(value: string | number | null): number | null {
  return value == null ? null : Number(value);
}

// ===== ASSETS ===============================================================

interface FixedAssetRow {
  client_id: string;
  company_id: number;
  code: string;
  name: string;
  category: string | null;
  location: string | null;
  department_id: string | null;
  employee_id: string | null;
  acquisition_date: Date | string;
  acquisition_cost: string | number;
  useful_life_years: number;
  method: FixedAssetMethod;
  is_passenger_car: boolean;
  salvage_value: string | number;
  opening_accumulated: string | number;
  asset_account_code: string | null;
  accum_account_code: string | null;
  expense_account_code: string | null;
  status: FixedAssetStatus;
  disposal_date: Date | string | null;
  disposal_amount: string | number | null;
  disposal_journal_entry_id: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

const ASSET_COLS =
  'client_id, company_id, code, name, category, location, department_id, employee_id, acquisition_date, acquisition_cost, useful_life_years, method, is_passenger_car, salvage_value, opening_accumulated, asset_account_code, accum_account_code, expense_account_code, status, disposal_date, disposal_amount, disposal_journal_entry_id, notes, created_at, updated_at';

function rowToAsset(row: FixedAssetRow): FixedAssetDto {
  return {
    id: row.client_id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    category: row.category,
    location: row.location,
    departmentId: row.department_id,
    employeeId: row.employee_id,
    acquisitionDate: isoDateOnly(row.acquisition_date) ?? '',
    acquisitionCost: num(row.acquisition_cost),
    usefulLifeYears: row.useful_life_years,
    method: row.method,
    isPassengerCar: row.is_passenger_car,
    salvageValue: num(row.salvage_value),
    openingAccumulated: num(row.opening_accumulated),
    assetAccountCode: row.asset_account_code,
    accumAccountCode: row.accum_account_code,
    expenseAccountCode: row.expense_account_code,
    status: row.status,
    disposalDate: isoDateOnly(row.disposal_date),
    disposalAmount: numOrNull(row.disposal_amount),
    disposalJournalEntryId: row.disposal_journal_entry_id,
    notes: row.notes,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

// ===== MOVEMENTS ============================================================

interface FixedAssetMovementRow {
  client_id: string;
  company_id: number;
  asset_client_id: string;
  type: FixedAssetMovementType | null;
  date: Date | string;
  amount: string | number | null;
  vat_rate: string | number | null;
  counter_account_code: string | null;
  gain_loss: string | number | null;
  from_location: string | null;
  to_location: string | null;
  notes: string | null;
  journal_entry_id: string | null;
  created_at: Date;
}

const MOVEMENT_COLS =
  'client_id, company_id, asset_client_id, type, date, amount, vat_rate, counter_account_code, gain_loss, from_location, to_location, notes, journal_entry_id, created_at';

function rowToMovement(row: FixedAssetMovementRow): FixedAssetMovementDto {
  return {
    id: row.client_id,
    companyId: row.company_id,
    assetId: row.asset_client_id,
    type: row.type,
    date: isoDateOnly(row.date) ?? '',
    amount: numOrNull(row.amount),
    vatRate: numOrNull(row.vat_rate),
    counterAccountCode: row.counter_account_code,
    gainLoss: numOrNull(row.gain_loss),
    fromLocation: row.from_location,
    toLocation: row.to_location,
    notes: row.notes,
    journalEntryId: row.journal_entry_id,
    createdAt: iso(row.created_at),
  };
}

// ===== DEPRECIATION RUNS ====================================================

interface DepreciationRunRow {
  client_id: string;
  company_id: number;
  period_start: string;
  period_end: string;
  run_date: Date | string | null;
  total: string | number;
  journal_entry_id: string | null;
  voucher_no: string | null;
  status: string;
  lines: DepreciationRunLineDto[] | null;
  created_at: Date;
  updated_at: Date;
}

const RUN_COLS =
  'client_id, company_id, period_start, period_end, run_date, total, journal_entry_id, voucher_no, status, lines, created_at, updated_at';

function rowToRun(row: DepreciationRunRow): DepreciationRunDto {
  return {
    id: row.client_id,
    companyId: row.company_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    runDate: isoDateOnly(row.run_date),
    total: num(row.total),
    journalEntryId: row.journal_entry_id,
    voucherNo: row.voucher_no,
    status: row.status,
    lines: row.lines ?? [],
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

// ===== REPOSITORY ===========================================================

export class PgFixedAssetRepository implements FixedAssetRepository {
  constructor(private readonly pool: Pool) {}

  async listAssets(companyId: number): Promise<FixedAssetDto[]> {
    const r = await this.pool.query<FixedAssetRow>(
      `SELECT ${ASSET_COLS} FROM fixed_assets WHERE company_id = $1 ORDER BY code, client_id`,
      [companyId],
    );
    return r.rows.map(rowToAsset);
  }

  async listMovements(companyId: number): Promise<FixedAssetMovementDto[]> {
    const r = await this.pool.query<FixedAssetMovementRow>(
      `SELECT ${MOVEMENT_COLS} FROM fixed_asset_movements
        WHERE company_id = $1 ORDER BY date DESC, client_id`,
      [companyId],
    );
    return r.rows.map(rowToMovement);
  }

  async listRuns(companyId: number): Promise<DepreciationRunDto[]> {
    const r = await this.pool.query<DepreciationRunRow>(
      `SELECT ${RUN_COLS} FROM fixed_asset_depreciation_runs
        WHERE company_id = $1 ORDER BY period_end DESC, client_id`,
      [companyId],
    );
    return r.rows.map(rowToRun);
  }

  async syncAll(payload: SyncFixedAssetsPayloadDto): Promise<SyncFixedAssetsResultDto> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      let assetsUpserted = 0;
      for (const a of payload.assets) {
        assetsUpserted += await upsertAsset(client, payload.companyId, a);
      }

      let movementsUpserted = 0;
      for (const m of payload.movements) {
        movementsUpserted += await upsertMovement(client, payload.companyId, m);
      }

      let runsUpserted = 0;
      for (const run of payload.runs) {
        runsUpserted += await upsertRun(client, payload.companyId, run);
      }

      let assetsDeleted = 0;
      let movementsDeleted = 0;
      let runsDeleted = 0;
      if (payload.prune === true) {
        movementsDeleted = await pruneExcept(
          client,
          'fixed_asset_movements',
          payload.companyId,
          payload.movements.map((m) => m.id),
        );
        runsDeleted = await pruneExcept(
          client,
          'fixed_asset_depreciation_runs',
          payload.companyId,
          payload.runs.map((r) => r.id),
        );
        assetsDeleted = await pruneExcept(
          client,
          'fixed_assets',
          payload.companyId,
          payload.assets.map((a) => a.id),
        );
      }

      await client.query('COMMIT');
      return {
        assetsUpserted,
        movementsUpserted,
        runsUpserted,
        assetsDeleted,
        movementsDeleted,
        runsDeleted,
      };
    } catch (err) {
      await safeRollback(client);
      throw err;
    } finally {
      client.release();
    }
  }
}

// ===== SQL yardımcıları =====================================================

async function upsertAsset(
  db: Queryable,
  companyId: number,
  a: SyncFixedAssetsPayloadDto['assets'][number],
): Promise<number> {
  const r = await db.query(
    `INSERT INTO fixed_assets
       (company_id, client_id, code, name, category, location, department_id,
        employee_id, acquisition_date, acquisition_cost, useful_life_years,
        method, is_passenger_car, salvage_value, opening_accumulated,
        asset_account_code, accum_account_code, expense_account_code, status,
        disposal_date, disposal_amount, disposal_journal_entry_id, notes, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
             $16, $17, $18, $19, $20, $21, $22, $23, COALESCE($24::timestamptz, NOW()))
     ON CONFLICT (company_id, client_id) DO UPDATE SET
       code = EXCLUDED.code,
       name = EXCLUDED.name,
       category = EXCLUDED.category,
       location = EXCLUDED.location,
       department_id = EXCLUDED.department_id,
       employee_id = EXCLUDED.employee_id,
       acquisition_date = EXCLUDED.acquisition_date,
       acquisition_cost = EXCLUDED.acquisition_cost,
       useful_life_years = EXCLUDED.useful_life_years,
       method = EXCLUDED.method,
       is_passenger_car = EXCLUDED.is_passenger_car,
       salvage_value = EXCLUDED.salvage_value,
       opening_accumulated = EXCLUDED.opening_accumulated,
       asset_account_code = EXCLUDED.asset_account_code,
       accum_account_code = EXCLUDED.accum_account_code,
       expense_account_code = EXCLUDED.expense_account_code,
       status = EXCLUDED.status,
       disposal_date = EXCLUDED.disposal_date,
       disposal_amount = EXCLUDED.disposal_amount,
       disposal_journal_entry_id = EXCLUDED.disposal_journal_entry_id,
       notes = EXCLUDED.notes`,
    [
      companyId,
      a.id,
      a.code,
      a.name,
      a.category,
      a.location,
      a.departmentId,
      a.employeeId,
      a.acquisitionDate,
      a.acquisitionCost,
      a.usefulLifeYears,
      a.method,
      a.isPassengerCar,
      a.salvageValue,
      a.openingAccumulated,
      a.assetAccountCode,
      a.accumAccountCode,
      a.expenseAccountCode,
      a.status,
      a.disposalDate,
      a.disposalAmount,
      a.disposalJournalEntryId,
      a.notes,
      a.createdAt,
    ],
  );
  return r.rowCount ?? 0;
}

async function upsertMovement(
  db: Queryable,
  companyId: number,
  m: SyncFixedAssetsPayloadDto['movements'][number],
): Promise<number> {
  const r = await db.query(
    `INSERT INTO fixed_asset_movements
       (company_id, client_id, asset_client_id, type, date, amount, vat_rate,
        counter_account_code, gain_loss, from_location, to_location, notes,
        journal_entry_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
             COALESCE($14::timestamptz, NOW()))
     ON CONFLICT (company_id, client_id) DO UPDATE SET
       asset_client_id = EXCLUDED.asset_client_id,
       type = EXCLUDED.type,
       date = EXCLUDED.date,
       amount = EXCLUDED.amount,
       vat_rate = EXCLUDED.vat_rate,
       counter_account_code = EXCLUDED.counter_account_code,
       gain_loss = EXCLUDED.gain_loss,
       from_location = EXCLUDED.from_location,
       to_location = EXCLUDED.to_location,
       notes = EXCLUDED.notes,
       journal_entry_id = EXCLUDED.journal_entry_id`,
    [
      companyId,
      m.id,
      m.assetId,
      m.type,
      m.date,
      m.amount,
      m.vatRate,
      m.counterAccountCode,
      m.gainLoss,
      m.fromLocation,
      m.toLocation,
      m.notes,
      m.journalEntryId,
      m.createdAt,
    ],
  );
  return r.rowCount ?? 0;
}

async function upsertRun(
  db: Queryable,
  companyId: number,
  run: SyncFixedAssetsPayloadDto['runs'][number],
): Promise<number> {
  const r = await db.query(
    `INSERT INTO fixed_asset_depreciation_runs
       (company_id, client_id, period_start, period_end, run_date, total,
        journal_entry_id, voucher_no, status, lines, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb,
             COALESCE($11::timestamptz, NOW()))
     ON CONFLICT (company_id, client_id) DO UPDATE SET
       period_start = EXCLUDED.period_start,
       period_end = EXCLUDED.period_end,
       run_date = EXCLUDED.run_date,
       total = EXCLUDED.total,
       journal_entry_id = EXCLUDED.journal_entry_id,
       voucher_no = EXCLUDED.voucher_no,
       status = EXCLUDED.status,
       lines = EXCLUDED.lines`,
    [
      companyId,
      run.id,
      run.periodStart,
      run.periodEnd,
      run.runDate,
      run.total,
      run.journalEntryId,
      run.voucherNo,
      run.status,
      JSON.stringify(run.lines ?? []),
      run.createdAt,
    ],
  );
  return r.rowCount ?? 0;
}

async function pruneExcept(
  db: Queryable,
  table: 'fixed_assets' | 'fixed_asset_movements' | 'fixed_asset_depreciation_runs',
  companyId: number,
  keepIds: readonly string[],
): Promise<number> {
  const r = await db.query(
    `DELETE FROM ${table} WHERE company_id = $1 AND NOT (client_id = ANY($2::text[]))`,
    [companyId, [...keepIds]],
  );
  return r.rowCount ?? 0;
}

async function safeRollback(client: { query: (q: string) => Promise<unknown> }): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // ROLLBACK hatası orijinal hatayı gölgelememeli
  }
}
