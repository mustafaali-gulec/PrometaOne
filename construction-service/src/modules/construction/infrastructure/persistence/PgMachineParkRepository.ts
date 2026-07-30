/**
 * PgMachineParkRepository — MachineParkRepository PG implementasyonu (FAZ 9).
 * Tablolar: cs_machines (genişletilmiş), cs_machine_meter_log,
 *   cs_machine_maintenance_plans, cs_machine_maintenance_records.
 *
 * BIGINT kolonları node-pg'de STRING döner — mapper Number() çevirir.
 */
import type { Pool } from 'pg';

import type {
  MachineParkDetailsUpdate,
  MachineParkRepository,
  MachineParkRow,
  MaintenancePlanRow,
  MaintenanceRecordRow,
  MeterLogRow,
  NewMaintenancePlanInput,
  NewMaintenanceRecordInput,
} from '../../application/ports/MachineParkRepository.js';
import type { MachineKind } from '../../domain/valueObjects/Labor.js';
import type {
  MaintenanceIntervalType,
  MeterType,
  RentalPeriod,
} from '../../domain/valueObjects/MachinePark.js';

const n = (v: string | number | null): number | null =>
  v === null ? null : typeof v === 'number' ? v : Number(v);
const nn = (v: string | number): number => (typeof v === 'number' ? v : Number(v));

interface ParkRow {
  id: string;
  company_id: number;
  code: string;
  name: string;
  kind: MachineKind;
  vendor_id: string | null;
  hourly_cost: string;
  active: boolean;
  brand: string | null;
  model: string | null;
  model_year: number | null;
  plate_no: string | null;
  chassis_no: string | null;
  engine_no: string | null;
  meter_type: MeterType;
  current_meter: string;
  purchase_date: string | null;
  rental_start: string | null;
  rental_end: string | null;
  rental_cost: string;
  rental_period: RentalPeriod | null;
  warranty_until: string | null;
  warranty_meter: string | null;
  park_note: string | null;
}

const PARK_COLS =
  'id, company_id, code, name, kind, vendor_id, hourly_cost, active, brand, model, model_year, ' +
  'plate_no, chassis_no, engine_no, meter_type, current_meter, ' +
  'purchase_date::text AS purchase_date, rental_start::text AS rental_start, ' +
  'rental_end::text AS rental_end, rental_cost, rental_period, ' +
  'warranty_until::text AS warranty_until, warranty_meter, park_note';

function toRow(r: ParkRow): MachineParkRow {
  return {
    id: nn(r.id),
    companyId: r.company_id,
    code: r.code,
    name: r.name,
    kind: r.kind,
    vendorId: n(r.vendor_id),
    hourlyCost: Number(r.hourly_cost),
    active: r.active,
    brand: r.brand,
    model: r.model,
    modelYear: r.model_year,
    plateNo: r.plate_no,
    chassisNo: r.chassis_no,
    engineNo: r.engine_no,
    meterType: r.meter_type,
    currentMeter: Number(r.current_meter),
    purchaseDate: r.purchase_date,
    rentalStart: r.rental_start,
    rentalEnd: r.rental_end,
    rentalCost: Number(r.rental_cost),
    rentalPeriod: r.rental_period,
    warrantyUntil: r.warranty_until,
    warrantyMeter: r.warranty_meter === null ? null : Number(r.warranty_meter),
    parkNote: r.park_note,
  };
}

/** camelCase alan → DB kolonu (updateDetails dinamik SET listesi için). */
const DETAIL_COLS: Record<keyof MachineParkDetailsUpdate, string> = {
  brand: 'brand',
  model: 'model',
  modelYear: 'model_year',
  plateNo: 'plate_no',
  chassisNo: 'chassis_no',
  engineNo: 'engine_no',
  meterType: 'meter_type',
  purchaseDate: 'purchase_date',
  rentalStart: 'rental_start',
  rentalEnd: 'rental_end',
  rentalCost: 'rental_cost',
  rentalPeriod: 'rental_period',
  warrantyUntil: 'warranty_until',
  warrantyMeter: 'warranty_meter',
  parkNote: 'park_note',
};

export class PgMachineParkRepository implements MachineParkRepository {
  constructor(private readonly pool: Pool) {}

  async findMachine(id: number, companyId: number): Promise<MachineParkRow | null> {
    const res = await this.pool.query<ParkRow>(
      `SELECT ${PARK_COLS} FROM cs_machines WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    return res.rows[0] === undefined ? null : toRow(res.rows[0]);
  }

  async listMachines(
    companyId: number,
    includeInactive = false,
  ): Promise<ReadonlyArray<MachineParkRow>> {
    const res = await this.pool.query<ParkRow>(
      `SELECT ${PARK_COLS} FROM cs_machines
        WHERE company_id = $1 ${includeInactive ? '' : 'AND active'}
        ORDER BY code`,
      [companyId],
    );
    return res.rows.map(toRow);
  }

  async updateDetails(
    id: number,
    companyId: number,
    patch: MachineParkDetailsUpdate,
  ): Promise<MachineParkRow> {
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [key, col] of Object.entries(DETAIL_COLS) as [
      keyof MachineParkDetailsUpdate,
      string,
    ][]) {
      const v = patch[key];
      if (v !== undefined) {
        params.push(v);
        sets.push(`${col} = $${String(params.length)}`);
      }
    }
    if (sets.length === 0) {
      const cur = await this.findMachine(id, companyId);
      return cur!;
    }
    params.push(id, companyId);
    const res = await this.pool.query<ParkRow>(
      `UPDATE cs_machines SET ${sets.join(', ')}, updated_at = NOW()
        WHERE id = $${String(params.length - 1)} AND company_id = $${String(params.length)}
        RETURNING ${PARK_COLS}`,
      params,
    );
    return toRow(res.rows[0]!);
  }

  async saveMeterReading(input: {
    companyId: number;
    machineId: number;
    readAt: string;
    meterValue: number;
    isReset: boolean;
    note: string | null;
    createdBy: number | null;
  }): Promise<MachineParkRow> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Aynı güne ikinci okuma üzerine yazar (düzeltme).
      await client.query(
        `INSERT INTO cs_machine_meter_log
           (company_id, machine_id, read_at, meter_value, is_reset, note, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (machine_id, read_at)
         DO UPDATE SET meter_value = EXCLUDED.meter_value, is_reset = EXCLUDED.is_reset,
                       note = EXCLUDED.note, created_by = EXCLUDED.created_by, created_at = NOW()`,
        [
          input.companyId,
          input.machineId,
          input.readAt,
          input.meterValue,
          input.isReset,
          input.note,
          input.createdBy,
        ],
      );
      const res = await client.query<ParkRow>(
        `UPDATE cs_machines SET current_meter = $1, updated_at = NOW()
          WHERE id = $2 AND company_id = $3
          RETURNING ${PARK_COLS}`,
        [input.meterValue, input.machineId, input.companyId],
      );
      await client.query('COMMIT');
      return toRow(res.rows[0]!);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async meterLog(machineId: number, companyId: number): Promise<ReadonlyArray<MeterLogRow>> {
    const res = await this.pool.query<{
      id: string;
      machine_id: string;
      read_at: string;
      meter_value: string;
      is_reset: boolean;
      note: string | null;
      created_by: number | null;
      created_at: Date;
    }>(
      `SELECT id, machine_id, read_at::text AS read_at, meter_value, is_reset, note,
              created_by, created_at
         FROM cs_machine_meter_log
        WHERE machine_id = $1 AND company_id = $2
        ORDER BY read_at DESC, id DESC`,
      [machineId, companyId],
    );
    return res.rows.map((r) => ({
      id: nn(r.id),
      machineId: nn(r.machine_id),
      readAt: r.read_at,
      meterValue: Number(r.meter_value),
      isReset: r.is_reset,
      note: r.note,
      createdBy: r.created_by,
      createdAt: r.created_at.toISOString(),
    }));
  }

  // ===== BAKIM ==============================================================

  private static readonly PLAN_COLS =
    'id, company_id, machine_id, name, interval_type, interval_value, last_done_meter, ' +
    'last_done_date::text AS last_done_date, note, active';

  async insertPlan(input: NewMaintenancePlanInput): Promise<MaintenancePlanRow> {
    const res = await this.pool.query<PlanRow>(
      `INSERT INTO cs_machine_maintenance_plans
         (company_id, machine_id, name, interval_type, interval_value, last_done_meter,
          last_done_date, note, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING ${PgMachineParkRepository.PLAN_COLS}`,
      [
        input.companyId,
        input.machineId,
        input.name,
        input.intervalType,
        input.intervalValue,
        input.lastDoneMeter,
        input.lastDoneDate,
        input.note,
        input.createdBy,
      ],
    );
    return toPlan(res.rows[0]!);
  }

  async findPlan(id: number, companyId: number): Promise<MaintenancePlanRow | null> {
    const res = await this.pool.query<PlanRow>(
      `SELECT ${PgMachineParkRepository.PLAN_COLS} FROM cs_machine_maintenance_plans
        WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    return res.rows[0] === undefined ? null : toPlan(res.rows[0]);
  }

  async listPlans(
    machineId: number,
    companyId: number,
  ): Promise<ReadonlyArray<MaintenancePlanRow>> {
    const res = await this.pool.query<PlanRow>(
      `SELECT ${PgMachineParkRepository.PLAN_COLS} FROM cs_machine_maintenance_plans
        WHERE machine_id = $1 AND company_id = $2 AND active
        ORDER BY name`,
      [machineId, companyId],
    );
    return res.rows.map(toPlan);
  }

  async updatePlan(
    id: number,
    companyId: number,
    patch: Partial<Omit<NewMaintenancePlanInput, 'companyId' | 'machineId' | 'createdBy'>>,
  ): Promise<MaintenancePlanRow> {
    const map: Record<string, string> = {
      name: 'name',
      intervalType: 'interval_type',
      intervalValue: 'interval_value',
      lastDoneMeter: 'last_done_meter',
      lastDoneDate: 'last_done_date',
      note: 'note',
    };
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [key, col] of Object.entries(map)) {
      const v = (patch as Record<string, unknown>)[key];
      if (v !== undefined) {
        params.push(v);
        sets.push(`${col} = $${String(params.length)}`);
      }
    }
    params.push(id, companyId);
    const res = await this.pool.query<PlanRow>(
      `UPDATE cs_machine_maintenance_plans SET ${sets.join(', ')}, updated_at = NOW()
        WHERE id = $${String(params.length - 1)} AND company_id = $${String(params.length)}
        RETURNING ${PgMachineParkRepository.PLAN_COLS}`,
      params,
    );
    return toPlan(res.rows[0]!);
  }

  async deactivatePlan(id: number, companyId: number): Promise<void> {
    await this.pool.query(
      `UPDATE cs_machine_maintenance_plans SET active = FALSE, updated_at = NOW()
        WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
  }

  async insertRecord(input: NewMaintenanceRecordInput): Promise<MaintenanceRecordRow> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query<RecordRow>(
        `INSERT INTO cs_machine_maintenance_records
           (company_id, machine_id, plan_id, done_at, meter_at, cost, description, vendor_id,
            created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id, company_id, machine_id, plan_id, done_at::text AS done_at, meter_at,
                   cost, description, vendor_id, created_by, created_at`,
        [
          input.companyId,
          input.machineId,
          input.planId,
          input.doneAt,
          input.meterAt,
          input.cost,
          input.description,
          input.vendorId,
          input.createdBy,
        ],
      );
      // Plana bağlı kayıt planın izini günceller — bir sonraki vade buradan.
      if (input.planId !== null) {
        await client.query(
          `UPDATE cs_machine_maintenance_plans
              SET last_done_date = $1,
                  last_done_meter = COALESCE($2, last_done_meter),
                  updated_at = NOW()
            WHERE id = $3 AND company_id = $4`,
          [input.doneAt, input.meterAt, input.planId, input.companyId],
        );
      }
      await client.query('COMMIT');
      return toRecord(res.rows[0]!);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async listRecords(
    machineId: number,
    companyId: number,
  ): Promise<ReadonlyArray<MaintenanceRecordRow>> {
    const res = await this.pool.query<RecordRow>(
      `SELECT id, company_id, machine_id, plan_id, done_at::text AS done_at, meter_at, cost,
              description, vendor_id, created_by, created_at
         FROM cs_machine_maintenance_records
        WHERE machine_id = $1 AND company_id = $2
        ORDER BY done_at DESC, id DESC`,
      [machineId, companyId],
    );
    return res.rows.map(toRecord);
  }
}

interface PlanRow {
  id: string;
  machine_id: string;
  name: string;
  interval_type: MaintenanceIntervalType;
  interval_value: string;
  last_done_meter: string | null;
  last_done_date: string | null;
  note: string | null;
  active: boolean;
}

function toPlan(r: PlanRow): MaintenancePlanRow {
  return {
    id: nn(r.id),
    machineId: nn(r.machine_id),
    name: r.name,
    intervalType: r.interval_type,
    intervalValue: Number(r.interval_value),
    lastDoneMeter: r.last_done_meter === null ? null : Number(r.last_done_meter),
    lastDoneDate: r.last_done_date,
    note: r.note,
    active: r.active,
  };
}

interface RecordRow {
  id: string;
  machine_id: string;
  plan_id: string | null;
  done_at: string;
  meter_at: string | null;
  cost: string;
  description: string;
  vendor_id: string | null;
  created_by: number | null;
  created_at: Date;
}

function toRecord(r: RecordRow): MaintenanceRecordRow {
  return {
    id: nn(r.id),
    machineId: nn(r.machine_id),
    planId: n(r.plan_id),
    doneAt: r.done_at,
    meterAt: r.meter_at === null ? null : Number(r.meter_at),
    cost: Number(r.cost),
    description: r.description,
    vendorId: n(r.vendor_id),
    createdBy: r.created_by,
    createdAt: r.created_at.toISOString(),
  };
}
