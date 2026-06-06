/**
 * Malzeme & Depo PG repository'leri. Material/Warehouse tek-statement (Queryable);
 * Stock (hareket+cache) ve MaterialRequest (header+lines) Pool ile transaction.
 * BIGINT id/FK alanları satır eşleyicide Number()'a çevrilir.
 */
import type { Pool, PoolClient } from 'pg';

import type {
  MaterialRepository,
  MaterialRequestRepository,
  MreqStatusChange,
  NewMaterialInput,
  NewMaterialRequestInput,
  NewMaterialRequestLineInput,
  NewStockMovementInput,
  NewWarehouseInput,
  StockRepository,
  StockView,
  WarehouseRepository,
} from '../../application/ports/MaterialRepositories.js';
import { Material } from '../../domain/entities/Material.js';
import {
  MaterialRequest,
  type MaterialRequestLineData,
  type MaterialRequestProps,
} from '../../domain/entities/MaterialRequest.js';
import { StockMovement } from '../../domain/entities/StockMovement.js';
import { Warehouse } from '../../domain/entities/Warehouse.js';
import type { MaterialRequestStatus, StockMoveKind } from '../../domain/valueObjects/Material.js';

import type { Queryable } from './Queryable.js';

// ===== MATERIAL =============================================================
interface MaterialRow {
  id: string;
  company_id: number;
  code: string;
  name: string;
  unit: string;
  waste_pct: string;
  active: boolean;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}
const M_COLS =
  'id, company_id, code, name, unit, waste_pct, active, created_by, created_at, updated_at';

export class PgMaterialRepository implements MaterialRepository {
  constructor(private readonly db: Queryable) {}
  async insert(input: NewMaterialInput): Promise<Material> {
    const r = await this.db.query<MaterialRow>(
      `INSERT INTO cs_materials (company_id, code, name, unit, waste_pct, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${M_COLS}`,
      [input.companyId, input.code, input.name, input.unit, input.wastePct, input.createdBy],
    );
    return rowToMaterial(r.rows[0]!);
  }
  async update(m: Material): Promise<void> {
    await this.db.query(
      `UPDATE cs_materials SET name=$1, unit=$2, waste_pct=$3, active=$4, updated_at=NOW()
       WHERE id=$5 AND company_id=$6`,
      [m.name, m.unit, m.wastePct, m.active, m.id, m.companyId],
    );
  }
  async findById(id: number, companyId: number): Promise<Material | null> {
    const r = await this.db.query<MaterialRow>(
      `SELECT ${M_COLS} FROM cs_materials WHERE id=$1 AND company_id=$2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToMaterial(row) : null;
  }
  async listByCompany(
    companyId: number,
    includeInactive?: boolean,
  ): Promise<ReadonlyArray<Material>> {
    const cond = includeInactive === true ? '' : ' AND active = TRUE';
    const r = await this.db.query<MaterialRow>(
      `SELECT ${M_COLS} FROM cs_materials WHERE company_id=$1${cond} ORDER BY code ASC`,
      [companyId],
    );
    return r.rows.map(rowToMaterial);
  }
  async existsByCode(companyId: number, code: string): Promise<boolean> {
    const r = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM cs_materials WHERE company_id=$1 AND code=$2) AS exists`,
      [companyId, code],
    );
    return r.rows[0]?.exists ?? false;
  }
}

function rowToMaterial(row: MaterialRow): Material {
  return Material.create({
    id: Number(row.id),
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    unit: row.unit,
    wastePct: Number(row.waste_pct),
    active: row.active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

// ===== WAREHOUSE ============================================================
interface WarehouseRow {
  id: string;
  company_id: number;
  project_id: string;
  code: string;
  name: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}
const W_COLS = 'id, company_id, project_id, code, name, active, created_at, updated_at';

export class PgWarehouseRepository implements WarehouseRepository {
  constructor(private readonly db: Queryable) {}
  async insert(input: NewWarehouseInput): Promise<Warehouse> {
    const r = await this.db.query<WarehouseRow>(
      `INSERT INTO cs_warehouses (company_id, project_id, code, name)
       VALUES ($1,$2,$3,$4) RETURNING ${W_COLS}`,
      [input.companyId, input.projectId, input.code, input.name],
    );
    return rowToWarehouse(r.rows[0]!);
  }
  async update(w: Warehouse): Promise<void> {
    await this.db.query(
      `UPDATE cs_warehouses SET name=$1, active=$2, updated_at=NOW() WHERE id=$3 AND company_id=$4`,
      [w.name, w.active, w.id, w.companyId],
    );
  }
  async findById(id: number, companyId: number): Promise<Warehouse | null> {
    const r = await this.db.query<WarehouseRow>(
      `SELECT ${W_COLS} FROM cs_warehouses WHERE id=$1 AND company_id=$2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToWarehouse(row) : null;
  }
  async listByProject(projectId: number, companyId: number): Promise<ReadonlyArray<Warehouse>> {
    const r = await this.db.query<WarehouseRow>(
      `SELECT ${W_COLS} FROM cs_warehouses WHERE project_id=$1 AND company_id=$2 ORDER BY code ASC`,
      [projectId, companyId],
    );
    return r.rows.map(rowToWarehouse);
  }
  async existsByCode(companyId: number, code: string): Promise<boolean> {
    const r = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM cs_warehouses WHERE company_id=$1 AND code=$2) AS exists`,
      [companyId, code],
    );
    return r.rows[0]?.exists ?? false;
  }
}

function rowToWarehouse(row: WarehouseRow): Warehouse {
  return Warehouse.create({
    id: Number(row.id),
    companyId: row.company_id,
    projectId: Number(row.project_id),
    code: row.code,
    name: row.name,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

// ===== STOCK ================================================================
interface MovementRow {
  id: string;
  company_id: number;
  material_id: string;
  kind: StockMoveKind;
  from_warehouse: string | null;
  to_warehouse: string | null;
  qty: string;
  unit_cost: string;
  boq_line_id: string | null;
  description: string | null;
  moved_at: string;
  created_by: number | null;
  created_at: Date;
}
interface StockViewRow {
  warehouse_id: string;
  warehouse_name: string;
  material_id: string;
  material_code: string;
  material_name: string;
  unit: string;
  qty: string;
}
const SM_COLS =
  'id, company_id, material_id, kind, from_warehouse, to_warehouse, qty, unit_cost, ' +
  'boq_line_id, description, moved_at::text AS moved_at, created_by, created_at';

export class PgStockRepository implements StockRepository {
  constructor(private readonly pool: Pool) {}

  async recordMovement(input: NewStockMovementInput): Promise<StockMovement> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query<MovementRow>(
        `INSERT INTO cs_stock_movements
           (company_id, material_id, kind, from_warehouse, to_warehouse, qty, unit_cost,
            boq_line_id, description, moved_at, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING ${SM_COLS}`,
        [
          input.companyId,
          input.materialId,
          input.kind,
          input.fromWarehouse,
          input.toWarehouse,
          input.qty,
          input.unitCost,
          input.boqLineId,
          input.description,
          input.movedAt,
          input.createdBy,
        ],
      );
      const incTo = input.kind === 'in' || input.kind === 'adjust' || input.kind === 'transfer';
      const decFrom = input.kind === 'out' || input.kind === 'waste' || input.kind === 'transfer';
      if (decFrom && input.fromWarehouse !== null) {
        await applyDelta(
          client,
          input.companyId,
          input.fromWarehouse,
          input.materialId,
          -input.qty,
        );
      }
      if (incTo && input.toWarehouse !== null) {
        await applyDelta(client, input.companyId, input.toWarehouse, input.materialId, input.qty);
      }
      await client.query('COMMIT');
      return rowToMovement(r.rows[0]!);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async listStockByProject(
    projectId: number,
    companyId: number,
  ): Promise<ReadonlyArray<StockView>> {
    const r = await this.pool.query<StockViewRow>(
      `SELECT s.warehouse_id, w.name AS warehouse_name, s.material_id, m.code AS material_code,
              m.name AS material_name, m.unit, s.qty
         FROM cs_stock s
         JOIN cs_warehouses w ON w.id = s.warehouse_id
         JOIN cs_materials m ON m.id = s.material_id
        WHERE w.project_id = $1 AND s.company_id = $2
        ORDER BY w.code, m.code`,
      [projectId, companyId],
    );
    return r.rows.map((row) => ({
      warehouseId: Number(row.warehouse_id),
      warehouseName: row.warehouse_name,
      materialId: Number(row.material_id),
      materialCode: row.material_code,
      materialName: row.material_name,
      unit: row.unit,
      qty: Number(row.qty),
    }));
  }

  async listMovementsByProject(
    projectId: number,
    companyId: number,
  ): Promise<ReadonlyArray<StockMovement>> {
    const r = await this.pool.query<MovementRow>(
      `SELECT ${SM_COLS} FROM cs_stock_movements
        WHERE company_id = $1
          AND (from_warehouse IN (SELECT id FROM cs_warehouses WHERE project_id = $2)
            OR to_warehouse IN (SELECT id FROM cs_warehouses WHERE project_id = $2))
        ORDER BY moved_at DESC, id DESC`,
      [companyId, projectId],
    );
    return r.rows.map(rowToMovement);
  }
}

async function applyDelta(
  client: PoolClient,
  companyId: number,
  warehouseId: number,
  materialId: number,
  delta: number,
): Promise<void> {
  await client.query(
    `INSERT INTO cs_stock (company_id, warehouse_id, material_id, qty)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (warehouse_id, material_id)
       DO UPDATE SET qty = cs_stock.qty + $4, updated_at = NOW()`,
    [companyId, warehouseId, materialId, delta],
  );
}

function rowToMovement(row: MovementRow): StockMovement {
  return StockMovement.create({
    id: Number(row.id),
    companyId: row.company_id,
    materialId: Number(row.material_id),
    kind: row.kind,
    fromWarehouse: row.from_warehouse !== null ? Number(row.from_warehouse) : null,
    toWarehouse: row.to_warehouse !== null ? Number(row.to_warehouse) : null,
    qty: Number(row.qty),
    unitCost: Number(row.unit_cost),
    boqLineId: row.boq_line_id !== null ? Number(row.boq_line_id) : null,
    description: row.description,
    movedAt: row.moved_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  });
}

// ===== MATERIAL REQUEST =====================================================
interface MreqHeaderRow {
  id: string;
  company_id: number;
  project_id: string;
  req_no: string;
  status: MaterialRequestStatus;
  needed_by: string | null;
  note: string | null;
  requested_by: number | null;
  approved_by: number | null;
  created_at: Date;
  updated_at: Date;
}
interface MreqLineRow {
  id: string;
  material_id: string;
  qty: string;
  note: string | null;
}
const MR_COLS =
  'id, company_id, project_id, req_no, status, needed_by::text AS needed_by, note, ' +
  'requested_by, approved_by, created_at, updated_at';

export class PgMaterialRequestRepository implements MaterialRequestRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: NewMaterialRequestInput): Promise<MaterialRequest> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query<{ id: number }>(
        `INSERT INTO cs_material_requests
           (company_id, project_id, req_no, status, needed_by, note, requested_by)
         VALUES ($1,$2,$3,'draft',$4,$5,$6) RETURNING id`,
        [
          input.companyId,
          input.projectId,
          input.reqNo,
          input.neededBy,
          input.note,
          input.requestedBy,
        ],
      );
      const id = r.rows[0]!.id;
      await insertReqLines(client, id, input.lines);
      await client.query('COMMIT');
      const created = await this.findById(id, input.companyId);
      if (!created) throw new Error('Talep insert sonrası okunamadı');
      return created;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findById(id: number, companyId: number): Promise<MaterialRequest | null> {
    const h = await this.pool.query<MreqHeaderRow>(
      `SELECT ${MR_COLS} FROM cs_material_requests WHERE id=$1 AND company_id=$2 LIMIT 1`,
      [id, companyId],
    );
    const header = h.rows[0];
    if (!header) return null;
    const ls = await this.pool.query<MreqLineRow>(
      `SELECT id, material_id, qty, note FROM cs_material_request_lines WHERE request_id=$1 ORDER BY id`,
      [id],
    );
    return buildRequest(header, ls.rows);
  }

  async listByProject(
    projectId: number,
    companyId: number,
  ): Promise<ReadonlyArray<MaterialRequest>> {
    const r = await this.pool.query<MreqHeaderRow>(
      `SELECT ${MR_COLS} FROM cs_material_requests WHERE project_id=$1 AND company_id=$2
        ORDER BY id DESC`,
      [projectId, companyId],
    );
    return r.rows.map((row) => buildRequest(row, []));
  }

  async countByProject(projectId: number, companyId: number): Promise<number> {
    const r = await this.pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM cs_material_requests WHERE project_id=$1 AND company_id=$2`,
      [projectId, companyId],
    );
    return Number(r.rows[0]?.n ?? '0');
  }

  async replaceLines(
    id: number,
    companyId: number,
    lines: ReadonlyArray<NewMaterialRequestLineInput>,
  ): Promise<MaterialRequest> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await assertOwned(client, id, companyId);
      await client.query(`DELETE FROM cs_material_request_lines WHERE request_id=$1`, [id]);
      await insertReqLines(client, id, lines);
      await client.query(`UPDATE cs_material_requests SET updated_at=NOW() WHERE id=$1`, [id]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    const out = await this.findById(id, companyId);
    if (!out) throw new Error('Talep okunamadı');
    return out;
  }

  async changeStatus(
    id: number,
    companyId: number,
    change: MreqStatusChange,
  ): Promise<MaterialRequest> {
    await this.pool.query(
      `UPDATE cs_material_requests SET status=$1, approved_by=$2, updated_at=NOW()
        WHERE id=$3 AND company_id=$4`,
      [change.toStatus, change.approvedBy, id, companyId],
    );
    const out = await this.findById(id, companyId);
    if (!out) throw new Error('Talep okunamadı');
    return out;
  }
}

async function assertOwned(client: PoolClient, id: number, companyId: number): Promise<void> {
  const r = await client.query(
    `SELECT id FROM cs_material_requests WHERE id=$1 AND company_id=$2 FOR UPDATE`,
    [id, companyId],
  );
  if (r.rows.length === 0) throw new Error('Talep bulunamadı (tenant)');
}

async function insertReqLines(
  client: PoolClient,
  requestId: number,
  lines: ReadonlyArray<NewMaterialRequestLineInput>,
): Promise<void> {
  for (const l of lines) {
    await client.query(
      `INSERT INTO cs_material_request_lines (request_id, material_id, qty, note)
       VALUES ($1,$2,$3,$4)`,
      [requestId, l.materialId, l.qty, l.note],
    );
  }
}

function buildRequest(
  header: MreqHeaderRow,
  lineRows: ReadonlyArray<MreqLineRow>,
): MaterialRequest {
  const lines: MaterialRequestLineData[] = lineRows.map((r) => ({
    id: Number(r.id),
    materialId: Number(r.material_id),
    qty: Number(r.qty),
    note: r.note,
  }));
  const props: MaterialRequestProps = {
    id: Number(header.id),
    companyId: header.company_id,
    projectId: Number(header.project_id),
    reqNo: header.req_no,
    status: header.status,
    neededBy: header.needed_by,
    note: header.note,
    requestedBy: header.requested_by,
    approvedBy: header.approved_by,
    createdAt: header.created_at,
    updatedAt: header.updated_at,
    lines,
  };
  return MaterialRequest.create(props);
}
