/**
 * PgAssetRepository — AssetRepository PG implementasyonu (asset + assignment ledger).
 *
 * Tablolar: hr_assets + hr_asset_assignments (020_hr_assets.sql).
 * Tüm sorgular company_id ile scope'lanır (multi-tenant izolasyon).
 * Tarih kolonları TIMESTAMPTZ olduğundan normalize gerekmez.
 */
import type {
  AssetRepository,
  NewAssetAssignmentInput,
  NewAssetInput,
} from '../../application/ports/AssetRepository.js';
import { Asset } from '../../domain/entities/Asset.js';
import { AssetAssignment } from '../../domain/entities/AssetAssignment.js';
import type { AssetStatus } from '../../domain/valueObjects/AssetStatus.js';
import type { AssetType } from '../../domain/valueObjects/AssetType.js';

import type { Queryable } from './Queryable.js';

interface AssetRow {
  id: number;
  company_id: number;
  asset_type: AssetType;
  name: string;
  brand: string | null;
  model: string | null;
  serial_no: string | null;
  status: AssetStatus;
  assigned_employee_id: number | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

interface AssetAssignmentRow {
  id: number;
  company_id: number;
  asset_id: number;
  employee_id: number;
  assigned_at: Date;
  assigned_by_user_id: number | null;
  returned_at: Date | null;
  returned_by_user_id: number | null;
  return_note: string | null;
  created_at: Date;
  updated_at: Date;
}

const ASSET_COLS =
  'id, company_id, asset_type, name, brand, model, serial_no, status, ' +
  'assigned_employee_id, notes, created_at, updated_at';

const ASSIGNMENT_COLS =
  'id, company_id, asset_id, employee_id, assigned_at, assigned_by_user_id, ' +
  'returned_at, returned_by_user_id, return_note, created_at, updated_at';

export class PgAssetRepository implements AssetRepository {
  constructor(private readonly pool: Queryable) {}

  // ---------------------------------------------------------------------------
  // assets
  // ---------------------------------------------------------------------------
  async createAsset(input: NewAssetInput): Promise<Asset> {
    const r = await this.pool.query<AssetRow>(
      `INSERT INTO hr_assets
         (company_id, asset_type, name, brand, model, serial_no, status,
          assigned_employee_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${ASSET_COLS}`,
      [
        input.companyId,
        input.assetType,
        input.name,
        input.brand,
        input.model,
        input.serialNo,
        input.status,
        input.assignedEmployeeId,
        input.notes,
      ],
    );
    return rowToAsset(r.rows[0]!);
  }

  async findAssetById(id: number, companyId: number): Promise<Asset | null> {
    const r = await this.pool.query<AssetRow>(
      `SELECT ${ASSET_COLS} FROM hr_assets WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, companyId],
    );
    const row = r.rows[0];
    return row ? rowToAsset(row) : null;
  }

  async listAssets(filter: {
    companyId: number;
    status?: AssetStatus;
    assignedEmployeeId?: number;
    type?: AssetType;
  }): Promise<ReadonlyArray<Asset>> {
    const conditions: string[] = ['company_id = $1'];
    const params: unknown[] = [filter.companyId];

    if (filter.status !== undefined) {
      params.push(filter.status);
      conditions.push(`status = $${params.length}`);
    }
    if (filter.assignedEmployeeId !== undefined) {
      params.push(filter.assignedEmployeeId);
      conditions.push(`assigned_employee_id = $${params.length}`);
    }
    if (filter.type !== undefined) {
      params.push(filter.type);
      conditions.push(`asset_type = $${params.length}`);
    }

    const r = await this.pool.query<AssetRow>(
      `SELECT ${ASSET_COLS} FROM hr_assets
        WHERE ${conditions.join(' AND ')}
        ORDER BY name ASC, id ASC`,
      params,
    );
    return r.rows.map(rowToAsset);
  }

  async updateAsset(asset: Asset): Promise<void> {
    await this.pool.query(
      `UPDATE hr_assets
         SET asset_type = $1,
             name = $2,
             brand = $3,
             model = $4,
             serial_no = $5,
             status = $6,
             assigned_employee_id = $7,
             notes = $8,
             updated_at = NOW()
       WHERE id = $9 AND company_id = $10`,
      [
        asset.assetType,
        asset.name,
        asset.brand,
        asset.model,
        asset.serialNo,
        asset.status,
        asset.assignedEmployeeId,
        asset.notes,
        asset.id,
        asset.companyId,
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // assignments (ledger)
  // ---------------------------------------------------------------------------
  async createAssignment(input: NewAssetAssignmentInput): Promise<AssetAssignment> {
    const r = await this.pool.query<AssetAssignmentRow>(
      `INSERT INTO hr_asset_assignments
         (company_id, asset_id, employee_id, assigned_at, assigned_by_user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${ASSIGNMENT_COLS}`,
      [input.companyId, input.assetId, input.employeeId, input.assignedAt, input.assignedByUserId],
    );
    return rowToAssetAssignment(r.rows[0]!);
  }

  async findOpenAssignmentForAsset(
    assetId: number,
    companyId: number,
  ): Promise<AssetAssignment | null> {
    const r = await this.pool.query<AssetAssignmentRow>(
      `SELECT ${ASSIGNMENT_COLS} FROM hr_asset_assignments
        WHERE asset_id = $1 AND company_id = $2 AND returned_at IS NULL
        ORDER BY assigned_at DESC, id DESC
        LIMIT 1`,
      [assetId, companyId],
    );
    const row = r.rows[0];
    return row ? rowToAssetAssignment(row) : null;
  }

  async closeAssignment(assignment: AssetAssignment): Promise<void> {
    await this.pool.query(
      `UPDATE hr_asset_assignments
         SET returned_at = $1,
             returned_by_user_id = $2,
             return_note = $3,
             updated_at = NOW()
       WHERE id = $4 AND company_id = $5`,
      [
        assignment.returnedAt,
        assignment.returnedByUserId,
        assignment.returnNote,
        assignment.id,
        assignment.companyId,
      ],
    );
  }

  async listAssignments(filter: {
    companyId: number;
    assetId?: number;
    employeeId?: number;
  }): Promise<ReadonlyArray<AssetAssignment>> {
    const conditions: string[] = ['company_id = $1'];
    const params: unknown[] = [filter.companyId];

    if (filter.assetId !== undefined) {
      params.push(filter.assetId);
      conditions.push(`asset_id = $${params.length}`);
    }
    if (filter.employeeId !== undefined) {
      params.push(filter.employeeId);
      conditions.push(`employee_id = $${params.length}`);
    }

    const r = await this.pool.query<AssetAssignmentRow>(
      `SELECT ${ASSIGNMENT_COLS} FROM hr_asset_assignments
        WHERE ${conditions.join(' AND ')}
        ORDER BY assigned_at DESC, id DESC`,
      params,
    );
    return r.rows.map(rowToAssetAssignment);
  }
}

function rowToAsset(row: AssetRow): Asset {
  return Asset.create({
    id: row.id,
    companyId: row.company_id,
    assetType: row.asset_type,
    name: row.name,
    brand: row.brand,
    model: row.model,
    serialNo: row.serial_no,
    status: row.status,
    assignedEmployeeId: row.assigned_employee_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function rowToAssetAssignment(row: AssetAssignmentRow): AssetAssignment {
  return AssetAssignment.create({
    id: row.id,
    companyId: row.company_id,
    assetId: row.asset_id,
    employeeId: row.employee_id,
    assignedAt: row.assigned_at,
    assignedByUserId: row.assigned_by_user_id,
    returnedAt: row.returned_at,
    returnedByUserId: row.returned_by_user_id,
    returnNote: row.return_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
